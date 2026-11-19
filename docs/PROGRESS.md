# Progress log (resume point for the next session)

Newest first. Keep short; details live in HANDOFF / VALIDATION.

## 2026-11-20 — Milestone 5: deployment readiness (Vercel Hobby + Render Free)
- Fresh-clone build without `analysis/` ✅; Render install in fresh 3.13.7 venv ✅; start command
  (`--workers 1`) served `/api/health` ✅; CORS allow/deny ✅.
- Memory: session-data budget (240 MB) with LRU eviction + 413, serialised parsing, MAX_SESSIONS 8.
- vercel.json no longer rewrites `/data/*`/`/assets/*`; loader rejects HTML as data; health timeout 95 s.
- `render.yaml` without AI key; `api/.python-version`; `web/.nvmrc`; DEPLOYMENT.md rewritten.
- Waiting on: personal GitHub repo URL from the user; no deployment performed.

## 2026-11-20 — Milestone 4: documentation, verification, production checks
- Docs: README, AGENTS.md, ARCHITECTURE, DATA_MAPPING, EDAGENT, DEPLOYMENT (platform limits checked
  2026-11-20), FEATURES, VALIDATION, HANDOFF, ATTRIBUTION.
- Grid map axis fix; production preview verified; render.yaml MAX_SESSIONS=5 for 512 MB.
- Open: live AI chat untested (no key); not deployed.

## 2026-11-20 — Milestone 3: verification + polish
- `scripts/verify_site_data.py` (749 checks). Found 2 undocumented report CI roundings; noted on site.
- Plotly cartesian bundle; correlation colours fixed; phone layouts; report reader scroll/page fixes.

## 2026-11-20 — Milestone 2: EDAgent
- `api/` FastAPI (in-memory sessions, ingest, profile, charts, grounded chat, exports), 24 tests.
- `web/src/edagent/` UI; verified end to end in the browser (without live AI).

## 2026-11-20 — Milestone 1: research site
- Export `v6-export-20261120-08` verified and published via `scripts/build_site_data.py`.
- Overview, chapters 1–6, Appendices, Report reader, Resources.
