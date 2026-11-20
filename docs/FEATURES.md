# Feature checklist

Legend: ✅ implemented and verified · ⚠️ implemented with a stated limitation · ⛔ not implemented (by decision or blocked)

## Research website

| Feature | Status | Notes |
| --- | --- | --- |
| Overview tab: project, key numbers, key findings with boundaries, features, links to Report/Resources, provenance | ✅ | Numbers quoted from the report; verified against data in `verify_site_data.py` |
| Six chapter tabs named exactly as the report | ✅ | Introduction · Data Cleaning · Visualization · Feature Engineering · Model Fitting · Conclusion & Future Scope |
| Appendices A–G | ✅ | Supplementary index, contribution/bio/references and the evidence-gate topic removed by request |
| Report wording preserved; section TOC; collapsible "Practical example" boxes | ✅ | One duplicated sentence in §3.6 of the PDF appears once on the site |
| All report figures (2.1–5.2) | ⚠️ | 12 interactive from exported data; **Figures 4.1 and 4.2 are shown as sharp crops rendered from the public report PDF, with an enlarged view** (not interactive) because their hexbin data is internal-review only |
| All report tables (2.1, 3.1, 5.1, 6.1, A.1–G.4) | ✅ | From exported CSVs, report rounding; data differences noted inline |
| Hover with exact values and denominators; zoom; legend toggling; PNG export of charts | ✅ | Plotly; modebar hidden on phones |
| "Published report view" vs "Exploring" badges with reset | ✅ | Exploration toggles: Fig 2.1 measure, 3.1 colouring, 3.5 log axis, 3.7 all categories, 3.8 all terms, D.1 chart, F.1 model filter |
| Per-figure data/provenance/compare panels | ⛔ | Removed by request (2026-11-20); hover still shows exact values and denominators |
| Interactive supplementary grid map (§4.4 statements) | ✅ | Labelled "not Figure 4.1"; zoom/pan/click; resolution and colour-scale toggles |
| Supplementary model diagnostics (AP intervals, calibration, ROC/PR, permutation importance, confusion matrices) | ✅ | Labelled "Not a report figure"; curves thinned for display only |
| Arbitrary year × category filters with recalculation | ⛔ | Needs record-level data that is internal; not offered |
| Report tab: page-turn book view, page navigation, outline jump, working internal PDF links, zoom (with limits), fullscreen, download | ✅ | Internal links resolve named destinations; `?page=N` clamped; fullscreen not re-verified |
| Report fallbacks: scroll view on narrow screens / reduced motion; native `<object>` viewer if pdf.js fails | ✅ | Reduced-motion: no page-turn animation; mode switch on wide screens |
| Resources: report, notebook, dataset links, EDAgent repository, references | ✅ | Downloads list, data dictionary/codebooks and field inventory removed by request; website repo is not public |
| Responsive layout (phone/tablet/desktop), keyboard focus, skip link, ARIA labels on charts | ✅ | No page-level horizontal scroll at 375 px on any tab |
| Live ML inference / scoring | ⛔ | Out of scope; models remain NOT_APPROVED_FOR_PRODUCTION |

## EDAgent

| Feature | Status | Notes |
| --- | --- | --- |
| Import CSV, TSV/TXT, JSON, JSON Lines, XLSX with declared limits | ✅ | 10 MB / 200k rows / 300 columns; URL import not supported |
| Overview and quality checks | ✅ | |
| Paginated row preview | ✅ | |
| Full-upload row lookup and search | ✅ | Rows tab search works without AI; chat has validated full-table lookup, filters, sorting, pagination and explicit match/truncation evidence; duplicate names are not merged |
| Configurable charts (bar, histogram, line, scatter, box, correlation) with validation | ✅ | Server-side aggregation over all rows |
| Dataset-grounded AI chat | ⚠️ | Full-table queries tested with a fake planner; lookup/partial-result answers are server-written. Other AI explanations check numbers, not every semantic claim. Live provider behavior remains unverified locally |
| Chat optional when no AI configuration | ✅ | Clear disabled state |
| Server-managed key per provider; optional BYOK (off by default) | ✅ | Gemini 3.1 Flash Lite default, Gemini presets available immediately; bounded/cancellable model checks; key field shown only when the server enables BYOK |
| Exports: HTML report, results JSON, ZIP with CSV tables | ✅ | HTML report loads Plotly from CDN for interactive charts; tables always included |
| Loading, error, empty, rate-limit, expired-session states | ✅ | |
| Accounts, saved/durable sessions, database | ⛔ | Not needed by implemented features (see ARCHITECTURE) |
