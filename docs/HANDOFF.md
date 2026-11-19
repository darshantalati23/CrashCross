# Handoff — current state (2026-11-20)

## State

Working website and EDAgent API, committed on `main` of `ExploratoryDataAnalysis/CrashCross`.
Everything in `docs/FEATURES.md` marked ✅ is implemented and was verified (see `docs/VALIDATION.md`).
Deployment-ready for Vercel Hobby + Render Free (see `docs/DEPLOYMENT.md`, checked 2026-11-20); not deployed. Deploy from a **personal** GitHub repository (URL not yet provided). AI chat is disabled in the initial deployment (no key in `render.yaml`).

## How to resume

1. Read `AGENTS.md` (rules), then this file and `docs/PROGRESS.md`.
2. `cd web; npm ci; npm run dev` and, for EDAgent, start the API (README quick start).
3. Run the three checks in `AGENTS.md` before and after changes.
4. The research inputs (`analysis/`, root PDF) are not in git. To rebuild `web/public/data` you need
   the export folder locally; otherwise use the committed bundle as-is.

## Open items / blockers

| Item | Owner action |
| --- | --- |
| Live AI chat untested against Anthropic | Set `ANTHROPIC_API_KEY` locally, ask 3–4 questions (in-scope, ambiguous, unrelated), confirm grounding labels; adjust `LLM_MODEL`/`LLM_EFFORT` if needed |
| Deployment | Push to a personal repo, then follow the dashboard tables in `docs/DEPLOYMENT.md` (Render first, then Vercel, then set `ALLOWED_ORIGINS`) |
| Render memory | Budget 240 MB of session data + serial parsing, measured on 10 MB CSVs; watch `session_memory_mb` in `/api/health` after launch |
| Publication of `aggregate_review` files | Team to confirm (see DATA_MAPPING "Publication policy") |
| Figures 4.1/4.2 static | Interactive version would need the hexbin GeoJSON to be re-classified as publishable (e.g. after suppressing low-count bins) and a new export run — do not reclassify by hand |
| Report CI rounding (12.10 vs 12.0946; 0.40 vs 0.3949) | Authors may correct the PDF; the site then needs only the note removed |
| EDAgent licence | Confirm licence of the EDAgent repository (none found) |

## Suggested next steps

- Deploy (static site first; it is independent of the API).
- Add Playwright smoke tests for routes, report reader and the EDAgent flow.
- Optional EDAgent improvements: filter builder for charts, sheet switcher for multi-sheet XLSX after
  upload (the API already accepts `sheet`), PNG embedding in the HTML report for offline viewing.
