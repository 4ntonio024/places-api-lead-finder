/**
 * places-api-lead-finder
 * ---------------------------------------------------------------------------
 * Google Apps Script that finds local businesses WITHOUT a real website using the
 * Google Places API (New) and writes them into the bound Google Sheet.
 *
 * Rationale: a small local business with no web presence is a prime lead for
 * web-design / digitalization services. Places returns a `websiteUri` per place;
 * if it's empty (or points to a social profile / site builder), it's a lead.
 *
 * Cost model: the field mask requests contact fields, which bills the
 * "Text Search Enterprise" SKU (1,000 free calls/month). Billing is per request,
 * not per result, and each request returns up to 20 places — so sweeping a handful
 * of towns stays well inside the free tier (~0). See docs/INSTALL.md.
 *
 * Not a scraper: this uses Google's official API. Mind the 30-day caching limit in
 * the Maps Platform ToS (place IDs may be stored indefinitely; other fields refreshed).
 *
 * License: MIT.
 */

// ================================ CONFIG ================================
const API_KEY  = 'PASTE_YOUR_API_KEY_HERE'; // Places API (New) key
const LANGUAGE = 'ca';   // result language (BCP-47): 'ca', 'es', 'en', ...
const REGION   = 'ES';   // result region bias (CLDR region code)
const MAX_PAGES = 3;     // pages per query (1-3). 20 results/page → up to 60 per query
const DELAY_MS  = 1200;  // pause between calls to respect the per-minute quota

// Output filter. By default only businesses with NO / WEAK website are exported.
// Flip to true to also export businesses that already have a real website.
const INCLUDE_BUSINESSES_WITH_WEBSITE = false;
// =======================================================================

const SHEET_CONFIG = 'Config';
const SHEET_LEADS  = 'Leads';

const HEADERS = [
  'Area', 'Niche', 'Name', 'Address', 'Phone',
  'Website status', 'Website', 'Type', 'Google Maps', 'Place ID', 'Fetched on'
];

// A websiteUri matching this is not a real, owned website → flagged WEAK (still an opportunity).
const WEAK_WEBSITE = /(facebook\.|instagram\.|wa\.me|whatsapp\.|wix\.com|\.wordpress\.com|linktr\.ee|business\.site|sites\.google\.com|blogspot\.|tiktok\.|t\.me\/|linkedin\.com)/i;

const STATUS = { NONE: 'NO WEBSITE', WEAK: 'WEAK WEBSITE', HAS: 'HAS WEBSITE' };

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';


/** Adds the custom menu when the spreadsheet opens. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('▶ Lead Finder')
    .addItem('1. Set up sheet', 'setupSheet')
    .addItem('2. Find leads', 'findLeads')
    .addSeparator()
    .addItem('Clear results', 'clearResults')
    .addToUi();
}


/** Creates the Config and Leads tabs and seeds example data. */
function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // --- Config tab ---
  const cfg = ss.getSheetByName(SHEET_CONFIG) || ss.insertSheet(SHEET_CONFIG);
  cfg.clear();
  cfg.getRange('A1').setValue('AREAS').setFontWeight('bold');
  cfg.getRange('C1').setValue('NICHES (keywords)').setFontWeight('bold');
  cfg.getRange('A1:C1').setBackground('#d9ead3');

  // Example data — replace with your own area(s) and niche keywords.
  // Example: three towns in Vallès Oriental (Catalonia, ES). Keywords mix
  // Spanish + Catalan on purpose, since local listings use both languages.
  const areas = [
    'Cardedeu',
    'Llinars del Vallès',
    'Sant Antoni de Vilamajor'
  ];
  const niches = [
    'chapa y pintura', 'taller mecánico', 'pneumàtics', 'neumáticos',
    'electricidad del automóvil', 'aire acondicionado coche', 'taller de motos', 'lavado de coches',
    'pladur', "fusteria d'alumini", 'carpintería de aluminio', 'fuster', 'carpintería de madera',
    'pintor', 'electricista', 'lampista', 'fontanero', 'parquet', 'cuines', 'cocinas',
    'vidrieria', 'cristalería', 'serraller', 'cerrajero', 'toldos',
    'forn de pa', 'panadería', 'carnisseria', 'carnicería', 'pastelería', 'fruteria', 'peixateria',
    'perruqueria', 'peluquería', 'barbería', 'estètica', 'centro de uñas', 'fisioterapia', 'podología',
    'ferretería', 'floristería', 'tienda de ropa', 'reparación electrodomésticos',
    'acadèmia', 'gestoría', 'veterinario', 'tintorería', 'clínica dental'
  ];

  cfg.getRange(2, 1, areas.length, 1).setValues(areas.map(a => [a]));
  cfg.getRange(2, 3, niches.length, 1).setValues(niches.map(n => [n]));
  cfg.setColumnWidth(1, 220);
  cfg.setColumnWidth(3, 280);

  // --- Leads tab ---
  const leads = ss.getSheetByName(SHEET_LEADS) || ss.insertSheet(SHEET_LEADS);
  leads.clear();
  leads.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
       .setFontWeight('bold').setBackground('#cfe2f3');
  leads.setFrozenRows(1);
  leads.autoResizeColumns(1, HEADERS.length);

  SpreadsheetApp.getUi().alert(
    'Sheet ready.\n\n' +
    '1) Edit the "Config" tab (your areas and niche keywords).\n' +
    '2) Make sure API_KEY is set in the script.\n' +
    '3) Menu ▶ Lead Finder → 2. Find leads.'
  );
}


/** Main loop: for each area × niche, query Places and append leads. */
function findLeads() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = ss.getSheetByName(SHEET_CONFIG);
  const leads = ss.getSheetByName(SHEET_LEADS);
  const ui = SpreadsheetApp.getUi();

  if (!cfg || !leads) { setupSheet(); return; }
  if (!API_KEY || API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
    ui.alert('Missing API key. Set API_KEY at the top of the script.');
    return;
  }

  const areas  = cfg.getRange('A2:A' + cfg.getLastRow()).getValues().flat().filter(String);
  const niches = cfg.getRange('C2:C' + cfg.getLastRow()).getValues().flat().filter(String);

  // Existing Place IDs (column 10) so re-runs don't create duplicates.
  const seen = new Set(
    leads.getLastRow() > 1
      ? leads.getRange(2, 10, leads.getLastRow() - 1, 1).getValues().flat()
      : []
  );

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  let added = 0, scanned = 0, calls = 0;

  for (const area of areas) {
    for (const niche of niches) {
      const query = niche + ' ' + area;
      let token = null, page = 0;

      do {
        const res = searchText_(query, token);
        calls++;

        if (res.error) {
          if (res.error.indexOf('PERMISSION_DENIED') > -1 || res.error.indexOf('403') > -1) {
            ui.alert('Places API permission error:\n\n' + res.error +
                     '\n\nCheck that "Places API (New)" is enabled and the API key is valid.');
            return;
          }
          break; // transient/other error: skip this query and continue
        }

        for (const place of (res.places || [])) {
          scanned++;
          if (place.businessStatus === 'CLOSED_PERMANENTLY') continue;
          if (seen.has(place.id)) continue;

          const status = classifyWebsite_(place.websiteUri);
          if (status === STATUS.HAS && !INCLUDE_BUSINESSES_WITH_WEBSITE) continue;

          leads.appendRow([
            area,
            niche,
            (place.displayName && place.displayName.text) || '',
            place.formattedAddress || '',
            place.nationalPhoneNumber || '',
            status,
            place.websiteUri || '',
            (place.primaryTypeDisplayName && place.primaryTypeDisplayName.text) || '',
            place.googleMapsUri || '',
            place.id,
            today
          ]);
          seen.add(place.id);
          added++;
        }

        token = res.nextPageToken || null;
        page++;
        if (token) Utilities.sleep(DELAY_MS);
      } while (token && page < MAX_PAGES);

      Utilities.sleep(DELAY_MS);
    }
  }

  leads.autoResizeColumns(1, HEADERS.length);
  ui.alert(
    'Done.\n\n' +
    'API calls: ' + calls + ' (of 1,000 free/month)\n' +
    'Places scanned: ' + scanned + '\n' +
    'New leads added: ' + added
  );
}


/**
 * Single Text Search (New) request.
 * The field mask drives cost: contact fields (websiteUri, phone) bill the
 * Enterprise SKU. `nextPageToken` must be in the mask to paginate.
 * @return {{places: Array, nextPageToken: ?string}|{error: string}}
 */
function searchText_(query, pageToken) {
  const payload = { textQuery: query, languageCode: LANGUAGE, regionCode: REGION, pageSize: 20 };
  if (pageToken) payload.pageToken = pageToken;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.websiteUri',
        'places.googleMapsUri',
        'places.primaryTypeDisplayName',
        'places.businessStatus',
        'nextPageToken'
      ].join(',')
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const resp = UrlFetchApp.fetch(PLACES_ENDPOINT, options);
    const code = resp.getResponseCode();
    const body = JSON.parse(resp.getContentText() || '{}');
    if (code !== 200) {
      const err = body.error || {};
      return { error: code + ' ' + (err.status || '') + ' ' + (err.message || '') };
    }
    return { places: body.places || [], nextPageToken: body.nextPageToken || null };
  } catch (e) {
    return { error: String(e) };
  }
}


/** Classifies a place's website into NONE / WEAK / HAS. */
function classifyWebsite_(uri) {
  if (!uri) return STATUS.NONE;
  if (WEAK_WEBSITE.test(uri)) return STATUS.WEAK;
  return STATUS.HAS;
}


/** Clears the Leads tab data (keeps the header row). */
function clearResults() {
  const leads = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_LEADS);
  if (leads && leads.getLastRow() > 1) {
    leads.getRange(2, 1, leads.getLastRow() - 1, HEADERS.length).clearContent();
  }
  SpreadsheetApp.getUi().alert('Leads cleared.');
}
