# Validation record — 2026-11-20

Environment: Windows 11, Node 22.16.0, Python 3.13.7, Chromium (Claude desktop browser pane).

## Export run

- `analysis/v6-export-20261120-08/COMPLETE.json` present, no `INCOMPLETE.json`; status
  `validated_with_documented_report_differences`; `required_checks_passed: true`.
- Manifest SHA-256 recomputed by the build script and equal to COMPLETE.json.
- Report PDF in the repository root has the export's baseline hash (`1e429cee…`).
- Only one run exists locally; the catalogue mentions an earlier `-06` run path as provenance only.
  No missing or failed required artifacts. 4 documented report differences (see DATA_MAPPING).

## Data bundle — `python scripts/verify_site_data.py`

`749 checks passed, 0 failed (55 frontend data references checked)`:
hash of every published file vs `site_manifest.json` and vs the export manifest (byte copies);
access class of every file; no internal artifacts; representative report values, including
248,810 rows / 191 fields / 205,544 known outcomes, annual low 9,863 (2020) and high 12,908 (2016),
77,476 common-era records and 3,233 serious/fatal, pedestrian 496/1,846 = 26.87%, night 5.86%,
OR 10.63 and dark/no-streetlight q 0.077, rear-end OR 0.45, χ² 3159.84 / V 0.2020,
HGB AP 0.1548 / AUC 0.6921, LR AUC 0.6990, RF-no-collision 0.0517 / 0.5461, queue 310/1,385,
cluster sizes 38,811/17,472 and shares 3.16–5.28%, silhouette 0.1172, 2024 valid hours 387,
speed-limit completeness 94.64%, coordinate audit 4.16 m / 36.91 m / 2,146, grid maxima 2,409 and 472;
every data path referenced in `web/src` exists. Notes raised: two CI roundings in the report prose
(pedestrian upper 12.10 vs 12.0946; rear-end lower 0.40 vs 0.3949) — shown on the site.

## API — `api/.venv/Scripts/python -m pytest api/tests -q`

`24 passed`: health/limits (no key leakage); CSV upload, kinds, missing counts, mean equals pandas;
JSON (3 layouts), JSONL, TSV, XLSX with sheet list; invalid type/empty/bad JSON/bad layout/bad XLSX/oversize;
7 valid chart specs and value equality with pandas group sums; 7 invalid chart combinations with clear
messages; chat disabled without key (503); chat with fake model: grounded answer, ungrounded numbers
withheld, decline, clarify, unknown column, non-approved operation ("exec_python") refused; BYOK refused
when disabled; HTML/JSON/ZIP exports; idle expiry → 404 `session_not_found`; delete; CSV formula-injection
guard; rate limiter; validation error shape.

## Frontend

- `npm run build` (tsc + vite): success. Plotly cartesian chunk 1.40 MB (479 KB gzip), pdf.js 364 KB, app ≈ 62 KB gzip.
- Production preview (`vite preview`): every tab loads; 23 Plotly charts on Visualization; data,
  manifest and SPA fallback return 200; EDAgent connects through the proxy.
- Responsive: at 375×812 no tab has page-level horizontal scroll; charts use compact margins on phones.
- Report reader: book mode at 1440×900 shows spreads (16–17 → 18–19 with page-turn leaf); `?page=17`
  deep link opens the right page in scroll mode; page counter follows scrolling; text layer present;
  pdf.js failure path displays the native viewer (observed during a dev-server race, since fixed).
- EDAgent in the browser: upload (CSV via file input) → overview with automatic date conversion →
  bar/line/histogram charts → session restored after reload → chat disabled notice → exports downloaded
  (HTML with 4 charts, ZIP 10 KB) → unknown session returns 404.

## Not exercised

- Live Anthropic API calls (no `ANTHROPIC_API_KEY` in this environment). The SDK call path
  (`chat._complete`, refusal handling, fallbacks parameter) is untested against the real service.
- Actual Vercel and Render deployments (instructions only; no accounts used).
- Screen-reader walkthrough and reduced-motion emulation (code paths reviewed, not tested with AT).
- Very large uploads near the 200k-row limit on a 512 MB instance.
