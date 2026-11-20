# Data and export mapping

Source: export run **`v6-export-20261120-08`** (`analysis/v6-export-20261120-08`), status
`validated_with_documented_report_differences`, completed 2026-11-19T20:52:50Z, manifest SHA-256
`61ebc869…2648`. It is the only run present and the only run used; no files from other runs are mixed in.
Report PDF SHA-256 `1e429cee…f212f` equals the export's report baseline.

## Publication policy

`scripts/build_site_data.py` copies files matching its `INCLUDE` patterns **only if** the manifest
`access` is `public_candidate_catalogue`, `public_candidate_reference` or `aggregate_review`
(255 files, 13.7 MB). Everything is hash-checked against the manifest; CSV/PNG/PDF/IPYNB are byte copies,
JSON is re-serialised compactly with identical values. Provenance is in `web/public/data/site_manifest.json`.

Not published (by policy or classification): `internal_review_only` (prepared record-level data,
scores, fold memberships, model joblibs, hexbin GeoJSON layers, notebook PNG/SVG renders, layer
denominators, `paired_summary.json`, `runtime.json`), `reference_review` (PennDOT/WPRDC codebook PDFs —
linked at publisher instead), unclassified working files. **Team decision to confirm:** the site treats
`aggregate_review` (aggregate tables without identifiers) as publishable because the report's figures
cannot be shown otherwise; change `PUBLISHABLE` in the build script if that is not acceptable.

Display derivatives (in `web/public/data/derived/`, clearly labelled in the UI):
`curves.json` (ROC/PR points omitted — never altered — to ≤ 1,500 per curve; full CSVs published),
`rounded_grid_{2,3}.json` (columnar copies of the rounded-grid CSVs), `catalogue_items.json`
(subset of catalogue fields per item).

> **2026-11-20:** per-figure download links and the Resources download list were removed from the UI on
> request. The bundle and its publication policy are unchanged (files remain at their `/data/...` URLs).
> Figures 4.1/4.2 are rendered as crops of the public report PDF (no new files).

## Report items

| Report item | Page (PDF) | Site location / component | Exported data used | Rendering |
| --- | --- | --- | --- | --- |
| Table 2.1 | 13 | Ch 2 · `Table2_1` | `chart_data/report_table_2_1/integrity.csv` | Table |
| Figure 2.1 | 15 | Ch 2 · `Figure2_1` | `report_figure_2_1/missing_top20.csv` | Interactive bars; toggle % / records (exploration) |
| Figure 2.2 | 15 | Ch 2 · `Figure2_2` | `report_figure_2_2/missing_percent_by_year.csv` | Interactive heatmap, magma_r 0–100 |
| Figure 3.1 | 17 | Ch 3 · `Figure3_1` | `report_figure_3_1/severity_counts.csv` | Bars; optional binary-group colouring (exploration) |
| Figure 3.2 | 18 | Ch 3 · `Figure3_2` | `report_figure_3_2/{annual,monthly,weekday,hour}.csv` | 4 panels; day codes kept as recorded |
| Figure 3.3 | 18 | Ch 3 · `Figure3_3` | `report_figure_3_3/{fatal,serious_fatal}.csv` | 2 panels; 2016 boundary marked; no pre-2016 serious/fatal |
| Figure 3.4 | 19 | Ch 3 · `Figure3_4` | `report_figure_3_4/{collision,road_relation,intersection,urban_rural}.csv` | 4 panels, top 12, urban/rural as source codes |
| Figure 3.5 | 20 | Ch 3 · `Figure3_5` | `report_figure_3_5/*_count.csv` | 6 panels, tail bin rule stated; log axis (exploration) |
| Figure 3.6 | 21 | Ch 3 · `Figure3_6` | `report_figure_3_6/{pearson,spearman}.csv`, `statistical_tables/correlation_pairwise_n.csv` | Heatmaps (coolwarm −1..1) with pairwise n on hover |
| Figure 3.7 | 22 | Ch 3 · `Figure3_7` | `report_figure_3_7/*.csv`; all categories from `report_table_e_{1,2}` | Report selection by default; full tables (exploration) |
| Table 3.1 | 23 | Ch 3 · `Table3_1` | `report_table_3_1/{association_tests,pooling_audit}.csv` | Table + pooling audit |
| Figure 3.8 | 24 | Ch 3 · `Figure3_8` | `report_figure_3_8/adjusted_selected.csv`; `models/adjusted_association/adjusted_or.csv` | Log-scale forest, red = q > 0.05; all terms (exploration) |
| Figure 4.1 | 26 | Ch 4 · `ReferenceImageFigure` | `reference_figures/report_page_26.png` | **Static image** — hexbin GeoJSON is internal_review_only |
| Figure 4.2 | 27 | Ch 4 · `ReferenceImageFigure` | `reference_figures/report_page_27.png` | **Static image** — same reason |
| §4.4 grid statements (2,409 / 472) | 27 | Ch 4 · `RoundedGridMap` (supplementary) | `spatial/rounded_grid_{2,3}.csv`, `spatial/county_boundary.geojson` | Interactive grid map, zoom/pan/click; labelled "not Figure 4.1" |
| §4.3 coordinate audit | 25–26 | Ch 4 · `LocationAuditTables` | `spatial/candidate_coordinate_summary.csv` | Table |
| Table 5.1 | 29 | Ch 5 · `Table5_1` | `report_table_5_1/model_comparison.csv` | Table; baseline AP printed 0.0445 with note |
| Figure 5.1 | 29 | Ch 5 · `Figure5_1` | `report_figure_5_1/model_bars.csv` | Grouped bars + prevalence line |
| Figure 5.2 | 31 | Ch 5 · `Figure5_2` | `report_figure_5_2/cluster_size.csv`, `models/exploratory_kmeans/candidate_diagnostics.csv` | Bars with post-hoc profile on hover |
| §5.4 diagnostics (supplementary) | – | Ch 5 disclosure | `model_evaluation/temporal_ap_intervals.csv`, `calibration_bin_counts.csv`, `*_roc.csv`, `*_precision_recall.csv`, `permutation_importance.csv`, `*_confusion_matrix.csv` | Interactive; labelled "Not a report figure" |
| Table 6.1 | 33 | Ch 6 · `Table6_1` | `report_table_6_1/practical_questions.csv` | Table |
| Table A.1 | 35 | Appendices · `TableA_1` | `report_table_a_1/selected_variable_notes.csv` | Table |
| Table A.2 | 36 | Appendices · `TableA_2` | `report_table_a_2/injury_report_display.csv` (+ `injury_all_checks.csv`) | Table + all checks; wording difference noted |
| Table D.1 | 39 | Appendices · `TableD_1` | `report_table_d_1/annual_record_outcome_coverage.csv` | Table; chart of same rows (exploration) |
| Table D.2 | 40 | Appendices · `TableD_2` | `report_table_d_2/valid_hour_coverage.csv` | Table (+ exported 02:00 column, labelled) |
| Tables E.1–E.3 | 41–42 | Appendices | `report_table_e_{1,2,3}/*.csv` | Tables |
| Table F.1 | 43 | Appendices · `TableF_1` | `report_table_f_1/review_queues.csv` | Table + linked precision/recall chart, model filter |
| Table G.1 | 45 | Appendices · `TableG_1` | `report_table_g_1/report_display_completeness.csv` | Report display values + raw non-missing column; difference noted |
| Tables G.2–G.4 | 45–47 | Appendices | `report_table_g_{2,3,4}/*.csv` | Tables |
| Supplementary S | – | Appendices § S · `SupplementaryIndex` | `derived/catalogue_items.json` | Index; links to published files only |

Appendix B, C, front matter, contribution, bio and references are text from the report.

## Documented differences between report and data (shown on the site)

From the export verification: (1) Table 5.1 baseline AP printed 0.0445, exact prevalence 0.044445… (0.0444);
(2) Appendix A.2 prose describes the component sum differently from the computed check;
(3) the adjusted formula also includes SPEED_LIMIT_VALID; (4) Table G.1 coordinate counts use the valid
pair count while percentages use marginal completeness.
Found during website verification (not flagged by the export): (5) §3.7/abstract pedestrian OR upper CI
printed 12.10, exported 12.0946 (12.09); (6) §3.7 rear-end OR lower CI printed 0.40, exported 0.3949 (0.39).

## Filters and linked views

Only filters that select exported rows are offered (category subsets, report selection vs full table,
model filter in Table F.1, grid resolution). Year × collision × severity recalculation would need
`prepared/analysis_internal.csv.gz`, which is internal and not published, so it is not offered.
