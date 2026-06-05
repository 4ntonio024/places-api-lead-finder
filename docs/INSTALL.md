# Install & setup

English first · [Español más abajo](#instalación-y-puesta-en-marcha)

## Requirements

- A Google account.
- A Google Cloud project with **billing enabled** (the free tier needs a billing account on file; you can cap quotas so you're never charged).

## 1. Enable the Places API (New)

1. [Google Cloud Console](https://console.cloud.google.com/) → select/create a project.
2. **APIs & Services → Library** → search **"Places API (New)"** → **Enable**.
   - It must be the **(New)** one, not the legacy "Places API".

## 2. Create and restrict an API key

1. **APIs & Services → Credentials → Create credentials → API key**. Copy it.
2. **Edit the key → API restrictions → Restrict key → Places API (New)**. Save.
   - Restricting the key means a leaked key is useless for anything else.

## 3. (Recommended) Guarantee $0

1. **Google Maps Platform → Quotas** → set a daily cap on **Text Search Enterprise** (e.g. 900). When hit, the API stops responding instead of billing you.
2. **Billing → Budgets & alerts** → create a budget alert at, say, $1 so you're emailed before any charge.

## 4. Add the script

1. Create a Google Sheet (`sheets.new`).
2. **Extensions → Apps Script**.
3. Replace the default `Code.gs` with [`src/Code.gs`](../src/Code.gs).
4. Set `API_KEY` at the top to your key. **Save.**

> Prefer not to hardcode the key? Store it in **Project Settings → Script properties** and read it with `PropertiesService.getScriptProperties().getProperty('API_KEY')`.

## 5. Authorize and run

1. Reload the sheet (F5). A **▶ Lead Finder** menu appears.
2. **▶ Lead Finder → 1. Set up sheet** → on first run, authorize the script (it's your own code).
   - This creates two tabs: **Config** (areas + niche keywords — edit freely) and **Leads** (results).
3. **▶ Lead Finder → 2. Find leads.** It pauses between calls; when done it reports calls used and leads added.

## 6. Using the output

In the **Leads** tab → **Data → Create a filter** and filter by:

- **Website status** → keep `NO WEBSITE` and `WEAK WEBSITE`.
- **Area** → plan your route.
- **Niche** → target one trade at a time.

The **Google Maps** column opens the listing to verify before calling; **Phone** is ready for outreach.

## Notes

- **Re-runs don't duplicate** (dedupe by Place ID). Use **Clear results** to start fresh.
- **Quota**: a full sweep of ~3 towns ≈ 100–150 of the 1,000 free monthly calls.
- **ToS**: work the list within days and refresh it; don't keep Places fields (other than Place ID) longer than 30 days.

---

# Instalación y puesta en marcha

## Requisitos

- Una cuenta de Google.
- Un proyecto de Google Cloud con **facturación activada** (la cuota gratuita exige una cuenta de facturación; puedes limitar cuotas para no pagar nunca).

## 1. Activar la Places API (New)

1. [Google Cloud Console](https://console.cloud.google.com/) → selecciona/crea un proyecto.
2. **APIs y servicios → Biblioteca** → busca **"Places API (New)"** → **Habilitar**.
   - Tiene que ser la **(New)**, no la "Places API" antigua.

## 2. Crear y restringir la API key

1. **APIs y servicios → Credenciales → Crear credenciales → Clave de API**. Cópiala.
2. **Editar clave → Restricciones de API → Restringir → Places API (New)**. Guarda.

## 3. (Recomendado) Blindar el 0 €

1. **Google Maps Platform → Quotas** → pon un límite diario a **Text Search Enterprise** (p. ej. 900). Si se alcanza, la API deja de responder en vez de cobrarte.
2. **Facturación → Presupuestos y alertas** → crea una alerta a 1 € para que te avise antes de cualquier cargo.

## 4. Añadir el script

1. Crea una Google Sheet (`sheets.new`).
2. **Extensiones → Apps Script**.
3. Sustituye el `Code.gs` por defecto por [`src/Code.gs`](../src/Code.gs).
4. Pon tu `API_KEY` arriba. **Guarda.**

> ¿Prefieres no escribir la clave en el código? Guárdala en **Configuración del proyecto → Propiedades del script** y léela con `PropertiesService.getScriptProperties().getProperty('API_KEY')`.

## 5. Autorizar y ejecutar

1. Recarga la hoja (F5). Aparece el menú **▶ Lead Finder**.
2. **▶ Lead Finder → 1. Set up sheet** → la primera vez, autoriza el script (es tu propio código).
   - Crea dos pestañas: **Config** (zonas + palabras clave) y **Leads** (resultados).
3. **▶ Lead Finder → 2. Find leads.** Hace pausas entre llamadas; al acabar informa de llamadas usadas y leads añadidos.

## 6. Usar el resultado

En **Leads** → **Datos → Crear un filtro** y filtra por **Website status** (`NO WEBSITE` / `WEAK WEBSITE`), **Area** y **Niche**. La columna **Google Maps** abre la ficha; **Phone** queda lista para prospectar.

## Notas

- **Re-ejecutar no duplica** (dedup por Place ID). Usa **Clear results** para empezar de cero.
- **Cuota**: un barrido de ~3 municipios ≈ 100–150 de las 1.000 llamadas gratis/mes.
- **TOS**: trabaja la lista en días y refréscala; no guardes campos de Places (salvo el Place ID) más de 30 días.
