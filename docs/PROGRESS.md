# Progress log (resume point for the next session)

Newest first. Keep short; details live in HANDOFF / VALIDATION.

## 2026-11-20 — Milestone 7: Vercel TypeScript build fix
- Removed unused `web/src/research/supplementary.tsx`, left behind after the supplementary index
  was removed from Appendices. It still imported the deleted `useCatalogue` hook, causing TS2305
  and cascading TS18046 errors because TypeScript checks every file under `src`.
- No active UI, report text, public data or API behavior changed.
- Validation: 763 data/UI checks, 30 API tests and `web/npm run build` all pass. API tests required
  running outside the sandbox because its socket restrictions stalled asyncio initialization.
- Delivery: committing this fix on personal-repository `main` for the requested push to
  `origin/main` (`darshantalati23/CrashCross`); live Vercel deployment remains unverified.

## 2026-11-20 — Milestone 6: QA fixes and requested removals (local commits on D:, not pushed/deployed)
- Source: `analysis/CrashCross_QA_Evidence/` (21 findings). D-01 (CORS) already fixed upstream; not touched.
- Removed: per-figure Data/How computed/Compare panels; Overview Data provenance; Resources public
  downloads, data dictionary/codebooks, field inventory; Appendices supplementary index, contribution/bio/
  references and evidence-gate topic; dead links to the non-public CrashCross repo.
- Fixed: axis-type leakage (Plotly mutated a shared layout) in Figs 3.2/3.3 and Ch5 diagnostics; PDF
  internal links (named destinations) in book + scroll modes; `?page=51`; render/zoom feedback; HTML
  export JSON escaping (incl. ZIP); leading zeros; identifier detection; Fig 2.2 colour scale; grid-map
  reset; Figures 4.1/4.2 sharp crops from the public PDF + enlarged view; jargon; accessibility.
- Checks: 763 data/UI checks, 30 API tests, production build — all pass. Browser-verified.

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

## 2026-11-20 — EDAgent: Gemini and Grok providers
- `api/app/providers.py`: small provider interface (`list_models`, `complete`) for Anthropic, Gemini, Grok; planner/explanation in `chat.py` use it unchanged.
- `POST /api/models` discovers a key's models and validates the selection (or Auto) with a minimal request; chat takes `X-LLM-Provider` / `X-LLM-Model`.
- Chat tab: provider selector, model selector (Auto + discovered), generic password key field. 40 API tests (`test_providers.py` added).

## 2026-11-20 — Milestone 3: verification + polish
- `scripts/verify_site_data.py` (749 checks). Found 2 undocumented report CI roundings; noted on site.
- Plotly cartesian bundle; correlation colours fixed; phone layouts; report reader scroll/page fixes.

## 2026-11-20 — Milestone 2: EDAgent
- `api/` FastAPI (in-memory sessions, ingest, profile, charts, grounded chat, exports), 24 tests.
- `web/src/edagent/` UI; verified end to end in the browser (without live AI).

## 2026-11-20 — Milestone 1: research site
- Export `v6-export-20261120-08` verified and published via `scripts/build_site_data.py`.
- Overview, chapters 1–6, Appendices, Report reader, Resources.
