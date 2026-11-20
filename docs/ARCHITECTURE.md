# Architecture

## Summary

```
            ┌──────────────────────── static site (Vercel / any CDN) ───────────────────────┐
 browser ──►│ React SPA (web/dist)                                                           │
            │  research pages ──fetch──► /data/*.csv|json|png|pdf  (web/public/data, static) │
            │  EDAgent tab ─────fetch──► VITE_EDAGENT_API_URL/api/* ──┐                      │
            └─────────────────────────────────────────────────────────┼──────────────────────┘
                                                                      ▼
                                     FastAPI (Render web service, api/) — in-memory sessions
                                       └── optional HTTPS call to Anthropic / Gemini / xAI Grok (chat)
```

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Research results | Static files served with the site | Fixed, verified results; no server needed; fast and cheap; the site works when the API sleeps |
| Data source | One explicitly identified export run (`v6-export-20261120-08`), verified at build time | Requirement: never mix runs; COMPLETE.json + manifest hash are checked |
| Publication filter | Manifest `access` classes | The export already classifies files; internal artifacts never reach the bundle |
| Frontend | React 18, Vite, TypeScript, Tailwind, Plotly (cartesian bundle), pdf.js | Same stack family as the existing EDAgent frontend; Plotly gives hover/zoom/legend toggling |
| Charts | Rebuilt client-side from exported CSV/JSON | Exact values, hover denominators, downloads; reference image only where data is not publishable |
| Report viewer | pdf.js canvas + text layer; custom CSS 3D page-turn | Selectable text, page navigation, zoom, fullscreen; no extra page-flip dependency; graceful fallbacks |
| Backend | FastAPI, only for EDAgent | Uploads, aggregation, AI calls and exports need server code; research does not |
| Storage | **None** (no DB, no accounts, no durable uploads) | Not required by any implemented feature; avoids personal-data retention and free-tier DB expiry |
| Sessions | In-memory, token per upload, 60-min idle TTL, LRU cap, cleared on restart | Simple and honest for a single small instance (Render free has 512 MB RAM and an ephemeral disk) |
| AI | Anthropic (official SDK), Gemini and Grok (REST via httpx) behind `api/app/providers.py`; server keys per provider; BYOK optional (off) | Key never reaches the browser; grounding enforced server-side |
| Query execution | Validated filters scan the full uploaded DataFrame before calculation, sorting or pagination; exact lookups use server-written answers | Prevents top-N summaries from being mistaken for whole-dataset searches; no generated code or sandbox |
| No-AI lookup | Existing Rows endpoint and tab accept literal column/value search, independent of AI keys | Search remains usable if provider quota is exhausted; no added database or retrieval bill |

## Frontend structure

- `src/main.tsx` — routes (lazy-loaded chapters, report, resources, EDAgent).
- `src/components/Layout.tsx` — header, research tabs + separated EDAgent tab, mobile menu, hash scrolling.
- `src/components/FigureFrame.tsx` — every report figure/table: exact caption, "Published report view"
  vs "Exploring" badge with reset, data table + downloads, provenance from the export catalogue
  (`derived/catalogue_items.json`), and "Compare with the report" (public page image + reader link).
- `src/components/Plot.tsx` — lazy Plotly wrapper; responsive margins/fonts on phones; reduced-motion aware.
- `src/lib/data.ts` — cached CSV/JSON loading; CSV empty cell → `null` (missing, never zero).
- Progressive disclosure: report "practical example" paragraphs are collapsed by default; data,
  provenance and supplementary diagnostics are in disclosures.

## Backend structure (`api/app`)

`main.py` routes and error shape (`{"error": {"code", "message"}}`) · `ingest.py` parsing + limits ·
`profile.py` overview/quality · `charts.py` chart validation + server-side aggregation → Plotly figure
+ table · `operations.py` approved operations and full-table filters/lookups · `chat.py` planner → validated
filter/execute (worker thread) → exact server summary for lookups/partial tables, otherwise optional AI explanation
and numeric consistency check · `report.py` HTML/JSON/ZIP exports · `sessions.py` store/TTL ·
`config.py` env settings · `util.py` JSON cleaning, rate limiter.

## Data flow for a research figure

`analysis/v6-export-20261120-08/chart_data/report_figure_3_7/collision.csv` →
`scripts/build_site_data.py` (access check, sha256 check, byte copy) →
`web/public/data/chart_data/report_figure_3_7/collision.csv` →
`Figure3_7` in `web/src/research/figures.tsx` (`useCsvs`) → Plotly bars with `known_n`,
`serious_fatal_n` in hover → `FigureFrame` downloads link to the same file.
