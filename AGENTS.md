# Guide for agents and contributors

Read this before changing anything. Then read `docs/HANDOFF.md` (state) and `docs/PROGRESS.md` (log).

## Non-negotiable rules

1. **Never execute the research notebooks or retrain models.** `analysis/EDA_v6.ipynb` is immutable
   reference material. All research numbers come from the completed export
   `analysis/v6-export-20261120-08` via `scripts/build_site_data.py`.
2. **Only publish files whose export-manifest `access` is `public_candidate_catalogue`,
   `public_candidate_reference` or `aggregate_review`.** Never publish `internal_review_only`
   (record-level data, scores, model binaries, hexbin GeoJSONs, notebook PNGs), `reference_review`
   (third-party codebook PDFs — link to the publisher instead) or unclassified files. The build
   script enforces this; don't bypass it by copying files by hand.
3. **Do not invent data or conclusions.** If a figure cannot be rebuilt from publishable data, show
   the public report-page image (`reference_figures/report_page_N.png`) and say why (see Figures 4.1
   and 4.2). Keep default views identical to the report; mark any exploration toggle with the
   "Exploring — differs from published view" badge (the `FigureFrame` `exploring` prop).
4. **Keep report wording.** Chapter text in `web/src/content/` is transcribed from the PDF. Only
   presentation changes are allowed (sections, collapsible "Practical example" boxes, links). When the
   data and the prose differ, keep the prose and add a visible note (see §3.7 callout).
5. **Preserve the distinction**: retrospective severity classification of reported crashes ≠
   predicting crash occurrence; counts ≠ risk; associations ≠ causes; models are
   `NOT_APPROVED_FOR_PRODUCTION`. No live scoring/prediction endpoint may be added without explicit
   authorisation.
6. **EDAgent is separate.** It only analyses the user's uploaded file. It must not load the crash
   data, run model-generated code, or invent statistics; chat answers must stay grounded
   (`api/app/chat.py: grounded`).
7. **Secrets**: never commit keys; the server key lives only in backend env vars; BYOK keys are
   per-request, never stored or logged.
8. Commit coherent milestones with clear messages and update `docs/PROGRESS.md` + `docs/HANDOFF.md`.

## Where things are

- Figure/table components: `web/src/research/figures.tsx` (ch. 2–3), `figures2.tsx` (ch. 4–5 + maps,
  diagnostics), `tables.tsx` (report tables), `supplementary.tsx` (catalogue index).
- Chapter text: `web/src/content/chapters1to3.tsx`, `chapters4to6.tsx`, `appendices.tsx`.
- Shared UI: `web/src/components/` (`FigureFrame` = caption, badges, data/provenance/compare disclosures).
- Report reader: `web/src/pages/Report.tsx` (pdf.js; book + scroll modes).
- EDAgent UI: `web/src/edagent/`; API: `api/app/` (`main.py` routes, `ingest.py`, `profile.py`,
  `charts.py`, `operations.py`, `chat.py`, `report.py`, `sessions.py`).

## Checks before committing

```powershell
python scripts/verify_site_data.py
api/.venv/Scripts/python -m pytest api/tests -q
cd web; npm run build
```

Add a check to `verify_site_data.py` whenever you add a figure that reproduces a printed number.
