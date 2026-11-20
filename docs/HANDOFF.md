# Handoff — current state (2026-11-20, Vercel build fix)

## State

Latest fix (milestone 7): removed the unused supplementary index module that still imported the
deleted `useCatalogue` hook and blocked Vercel's TypeScript build. No active UI or data changed.
Validation and push status are recorded in `docs/PROGRESS.md`.

Current checkout: `C:\Darshan\CrashCross`, on `main` of `darshantalati23/CrashCross`.
Everything in `docs/FEATURES.md` marked ✅ is implemented and was verified (see `docs/VALIDATION.md`).
The reported Vercel deployment failed during TypeScript compilation; milestone 7 fixes that failure.
Live deployment status has not been verified. AI chat is disabled in the initial deployment (no key in `render.yaml`).

The D-drive sync/deployment notes below describe the earlier milestone 6 handoff; the current
personal-repository checkout above supersedes its source-location and missing-repository notes.

## How to resume

1. Read `AGENTS.md` (rules), then this file and `docs/PROGRESS.md`.
2. `cd web; npm ci; npm run dev` and, for EDAgent, start the API (README quick start).
3. Run the three checks in `AGENTS.md` before and after changes.
4. The research inputs (`analysis/`, root PDF) are not in git. To rebuild `web/public/data` you need
   the export folder locally; otherwise use the committed bundle as-is.

## Latest round (QA fixes) — see PROGRESS milestone 6

Development source is `D:\Darshan\CrashCross`; commits 348f638…a7d4744 are **local** on `main` here.
They have **not** been pushed to any remote, synced to the C-drive personal repository, or deployed, so the
live site still shows the pre-fix behaviour until someone syncs and redeploys.

QA findings status (`analysis/CrashCross_QA_Evidence/CrashCross_QA_Report.md`):

| ID | Status |
| --- | --- |
| D-01 CORS | Already fixed in hosting; not changed here |
| D-02 HTML export injection | Fixed (`report.json_for_script`), test covers HTML + ZIP |
| D-03 / D-04 category axes | Fixed: root cause was Plotly writing autotyped `category` into a shared layout object; layout cloned per render + explicit axis types; browser-checked at 627 px and desktop |
| D-05 dead repo links | Removed (repository is not public); EDAgent link verified 200 |
| D-06 missing spaces | Text lived in the removed provenance/how-computed panels |
| D-07 jargon | Replaced in footer, Ch 3.7 note, Ch 5 caution, table footnotes, Fig 4.1/4.2 reason |
| D-08 leading zeros / D-09 identifiers | Fixed + tests |
| D-10 grid map | Fixed (reset restores resolution; badge; instructions) |
| D-11 `?page=51` | Fixed (clamped) |
| D-12 cover overlap | In the PDF itself; PDF not modified |
| D-13 zoom limits | Fixed (buttons disable at 50%/300%); fullscreen **unconfirmed** (needs a real user gesture to test) |
| D-14 student IDs public | Team decision (report content unchanged) |
| D-15 Python 3.13.18 vs notebook 3.13.5 | Not changed (report wording rule); team to confirm |
| D-16 titles / duplicate link / skip link | Fixed |
| D-17 inventory filter | Feature removed by request |
| D-18 headings, table names, Escape, loading | Fixed; inline link target size not changed |
| D-19 | Stray-dot section removed; D.1 axis overlap fixed; Fig 2.2 colours fixed; `index_0` CSV headers remain in the data files (downloads no longer linked); §5.4 grammar is report wording |
| D-20 | `bins=0`/`top_n=0` rejected; heatmap defaults to numeric columns; renames noted; double delete is idempotent by design |
| D-21 | Informational |

Note: removed panels are UI-only. Published data files under `web/public/data` are unchanged and still served
by URL; publication restrictions are unchanged. `FigureFrame` still accepts the old props but does not render them.

## Open items / blockers

| Item | Owner action |
| --- | --- |
| Sync + deploy the new commits | Push D-drive `main` to the deployment repository when approved, then redeploy Vercel (and Render for the API fixes) |
| Live AI chat untested against Anthropic, Gemini and Grok | Set a provider key locally (or use BYOK), run "Check key & model" (Auto), ask 3–4 questions (in-scope, ambiguous, unrelated), confirm grounding labels; Gemini/Grok request shapes follow current official docs but only mocked HTTP was tested; adjust `LLM_MODEL`/`LLM_EFFORT` (Anthropic) if needed |
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
