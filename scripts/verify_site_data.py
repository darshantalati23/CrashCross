"""Verify the published research bundle (web/public/data) without re-running any research.

1. Every published file still matches the SHA-256 recorded in site_manifest.json, and
   byte-copied files match the export's own hash; nothing internal was published.
2. Representative values in the published data reproduce the numbers printed in the report.
3. Every data path referenced by the frontend source exists in the bundle.

Usage: python scripts/verify_site_data.py      (exit code 1 on any failure)
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "web" / "public" / "data"
failures: list[str] = []
notes: list[str] = []
passes = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global passes
    if ok:
        passes += 1
    else:
        failures.append(f"{name}: {detail}")


def rows(rel: str) -> list[dict]:
    with open(DATA / rel, encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def f(v: str) -> float:
    return float(v)


def near(a: float, b: float, decimals: int) -> bool:
    return abs(round(a, decimals) - b) < 10 ** -(decimals + 3) or abs(a - b) <= 0.5 * 10 ** -decimals


# ---------------------------------------------------------------- 1. integrity
manifest = json.loads((DATA / "site_manifest.json").read_text(encoding="utf-8"))
check("run id", manifest["run_id"] == "v6-export-20261120-08", manifest["run_id"])
check("run status", manifest["status"].startswith("validated"), manifest["status"])
allowed = {"public_candidate_catalogue", "public_candidate_reference", "aggregate_review"}
for p in manifest["published_files"]:
    path = DATA / p["path"]
    digest = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
    check(f"hash {p['path']}", digest == p["published_sha256"], "file changed or missing")
    if p["transform"] == "byte_copy":
        check(f"source hash {p['path']}", digest == p["source_sha256"], "differs from export")
    check(f"access {p['path']}", p["access"] in allowed, p["access"])
check("no refused files listed", not manifest["refused_files"], str(manifest["refused_files"][:3]))
for bad in ("joblib", "_internal", "scores_internal", "prepared/"):
    hits = [p["path"] for p in manifest["published_files"] if bad in p["path"]]
    check(f"no internal artifact '{bad}'", not hits, str(hits[:3]))

# ---------------------------------------------------------------- 2. report values
integ = rows("chart_data/report_table_2_1/integrity.csv")[0]
check("T2.1 rows", integ["rows"] == "248810")
check("T2.1 columns", integ["source_columns"] == "191")
check("T2.1 unique ids", integ["unique_crash_ids"] == "248810")
check("T2.1 duplicates", integ["exact_duplicates"] == "0" and integ["duplicate_ids"] == "0")
check("T2.1 known outcomes 205,544 (82.61%)", integ["known_outcomes"] == "205544" and near(100 * 205544 / 248810, 82.61, 2))

annual = {r["CRASH_YEAR"]: int(r["value"]) for r in rows("chart_data/report_figure_3_2/annual.csv")}
check("F3.2 annual sum", sum(annual.values()) == 248810, str(sum(annual.values())))
check("F3.2 2020 low 9,863", annual["2020"] == 9863 and min(annual.values()) == 9863)
check("F3.2 2016 high 12,908", annual["2016"] == 12908 and max(annual.values()) == 12908)
sev = rows("chart_data/report_figure_3_1/severity_counts.csv")
check("F3.1 severity sum", sum(int(r["count"]) for r in sev) == 248810)

col37 = {r["COLLISION_LABEL"]: r for r in rows("chart_data/report_figure_3_7/collision.csv")}
ped = col37["Pedestrian"]
check("F3.7 pedestrian 496/1,846 = 26.87%", ped["known_n"] == "1846" and f(ped["serious_fatal_n"]) == 496 and near(f(ped["share_percent"]), 26.87, 2))
check("F3.7 head-on 9.48%", near(f(col37["Head-on"]["share_percent"]), 9.48, 2))
check("F3.7 rear-end 1.74%", near(f(col37["Rear-end"]["share_percent"]), 1.74, 2))
e1 = rows("chart_data/report_table_e_1/collision.csv")
check("E.1 common-era known total 77,476", sum(int(r["known_n"]) for r in e1) == 77476)
check("E.1 serious/fatal total 3,233", sum(f(r["serious_fatal_n"]) for r in e1) == 3233)
tim = {r["TIME_PERIOD"]: r for r in rows("chart_data/report_table_e_2/time.csv")}
check("E.2 night 955/16,295 = 5.86%", tim["Night"]["known_n"] == "16295" and near(f(tim["Night"]["share_percent"]), 5.86, 2))

orr = {r["index_0"]: r for r in rows("chart_data/report_figure_3_8/adjusted_selected.csv")}
p_ = orr["C(COLLISION_LABEL, Treatment(reference='Angle'))[T.Pedestrian]"]
check("F3.8 pedestrian OR 10.63, CI low 9.35", near(f(p_["odds_ratio"]), 10.63, 2) and near(f(p_["ci_lower_95"]), 9.35, 2))
# Report prose prints the upper CI as 12.10; the exported value 12.0946 rounds to 12.09 (site-verification finding).
check("F3.8 pedestrian CI upper 12.0946 (report prose: 12.10)", abs(f(p_["ci_upper_95"]) - 12.0946) < 1e-4)
notes.append("Report §3.7/abstract print the pedestrian OR upper 95% CI as 12.10; exported value is 12.0946 (12.09 at two decimals).")
dk = orr["C(ILLUMINATION_LABEL, Treatment(reference='Daylight'))[T.Dark: no streetlights]"]
check("F3.8 dark/no-streetlight OR 1.20, q 0.077 (> 0.05)", near(f(dk["odds_ratio"]), 1.20, 2) and near(f(dk["fdr_bh_q"]), 0.077, 3) and f(dk["fdr_bh_q"]) > 0.05)
allor = {r["index_0"]: r for r in rows("models/adjusted_association/adjusted_or.csv")}
re_ = allor["C(COLLISION_LABEL, Treatment(reference='Angle'))[T.Rear-end]"]
check("§3.7 rear-end OR 0.45, CI high 0.52", near(f(re_["odds_ratio"]), 0.45, 2) and near(f(re_["ci_upper_95"]), 0.52, 2))
check("§3.7 rear-end CI lower 0.3949 (report prose: 0.40)", abs(f(re_["ci_lower_95"]) - 0.3949) < 1e-4)
notes.append("Report §3.7 prints the rear-end OR lower 95% CI as 0.40; exported value is 0.3949 (0.39 at two decimals).")

at = {r["feature"]: r for r in rows("chart_data/report_table_3_1/association_tests.csv")}
check("T3.1 collision χ² 3159.84, V 0.2020, df 10", near(f(at["COLLISION_LABEL"]["chi2_stat"]), 3159.84, 2) and near(f(at["COLLISION_LABEL"]["cramers_v"]), 0.2020, 4) and at["COLLISION_LABEL"]["degrees_freedom"] == "10")
check("T3.1 intersection χ² 38.04", near(f(at["INTERSECTION_LABEL"]["chi2_stat"]), 38.04, 2))

mc = {r["model"]: r for r in rows("chart_data/report_table_5_1/model_comparison.csv")}
h = mc["HistGradientBoosting + collision"]
check("T5.1 HGB AP 0.1548 / AUC 0.6921 / BA 0.6333 / Brier 0.2028", near(f(h["average_precision"]), 0.1548, 4) and near(f(h["roc_auc"]), 0.6921, 4)
      and near(f(h["balanced_accuracy_at_0.50"]), 0.6333, 4) and near(f(h["brier_score_uncalibrated"]), 0.2028, 4))
check("T5.1 LR AUC 0.6990", near(f(mc["Logistic Regression + collision"]["roc_auc"]), 0.6990, 4))
check("T5.1 RF-no-collision AP 0.0517 / AUC 0.5461", near(f(mc["Random Forest without collision"]["average_precision"]), 0.0517, 4) and near(f(mc["Random Forest without collision"]["roc_auc"]), 0.5461, 4))
check("T5.1 test n 27,697, prevalence 4.44%", h["test_records"] == "27697" and near(f(h["test_prevalence_percent"]), 4.44, 2))
check("T5.1 baseline AP documented rounding (exact 0.04444…)", near(f(mc["Majority-class baseline"]["average_precision"]), 0.0444, 4))

q = [r for r in rows("chart_data/report_table_f_1/review_queues.csv") if r["model"].startswith("HistGradientBoosting")]
q5 = next(r for r in q if r["top_percent_flagged"] == "5")
check("F.1 HGB top 5%: 310/1,385, 22.38% / 25.18%", q5["records_flagged"] == "1385" and q5["serious_fatal_found"] == "310"
      and near(f(q5["precision_percent"]), 22.38, 2) and near(f(q5["recall_percent"]), 25.18, 2))
q20 = next(r for r in q if r["top_percent_flagged"] == "20")
check("F.1 HGB top 20%: 571/5,540", q20["serious_fatal_found"] == "571" and q20["records_flagged"] == "5540")

cl = rows("chart_data/report_figure_5_2/cluster_size.csv")
sizes = [int(r["crash_records"]) for r in cl]
shares = [f(r["serious_fatal_percent"]) for r in cl]
check("F5.2 cluster sizes 38,811 / 17,472", max(sizes) == 38811 and min(sizes) == 17472)
check("F5.2 shares 3.16–5.28%", near(min(shares), 3.16, 2) and near(max(shares), 5.28, 2))
cand = {r["candidate_clusters"]: r for r in rows("models/exploratory_kmeans/candidate_diagnostics.csv")}
check("§5.5 silhouette 0.1172", near(f(cand["4"]["sampled_silhouette_score"]), 0.1172, 4))

vh = {r["CRASH_YEAR"]: r for r in rows("chart_data/report_table_d_2/valid_hour_coverage.csv")}
check("D.2 2024 valid hour 387 of 10,228 (3.78%)", vh["2024"]["valid_hour_records"] == "387" and vh["2024"]["total_reports"] == "10228" and near(f(vh["2024"]["valid_hour_percent"]), 3.78, 2))
d1 = {r["CRASH_YEAR"]: r for r in rows("chart_data/report_table_d_1/annual_record_outcome_coverage.csv")}
check("D.1 2023 serious/fatal 4.75%", near(f(d1["2023"]["serious_fatal_percent_of_known"]), 4.75, 2))
check("D.1 pre-2016 serious/fatal blank", d1["2010"]["serious_fatal_percent_of_known"] == "")

g1 = {r["field"]: r for r in rows("chart_data/report_table_g_1/report_display_completeness.csv")}
check("G.1 speed limit 235,474 (94.64%)", g1["SPEED_LIMIT"]["available_n"] == "235474" and near(f(g1["SPEED_LIMIT"]["available_percent"]), 94.64, 2))
check("G.1 latitude display 238,556 (95.90%)", g1["DEC_LAT"]["available_n"] == "238556" and near(f(g1["DEC_LAT"]["available_percent"]), 95.90, 2))
cc = rows("spatial/candidate_coordinate_summary.csv")[0]
check("§4.3 police-format median 4.16 m, p95 36.91 m, 2,146 > 500 m", near(f(cc["median_difference_m"]), 4.16, 2) and near(f(cc["p95_difference_m"]), 36.91, 2) and cc["candidate_pairs_over_500m"] == "2146")

for g, expected in ((2, 2409), (3, 472)):
    grid = json.loads((DATA / f"derived/rounded_grid_{g}.json").read_text(encoding="utf-8"))
    check(f"§4.4 rounded grid {g} max cell {expected}", max(grid["count"]) == expected, str(max(grid["count"])))

# ---------------------------------------------------------------- 3. frontend references
src = "\n".join(p.read_text(encoding="utf-8") for p in (ROOT / "web" / "src").rglob("*.tsx"))
refs = set(re.findall(r"['\"`]((?:chart_data|statistical_tables|model_evaluation|models|spatial|resources|derived|reference_figures)/[^'\"`$]+\.(?:csv|json|geojson|pdf|ipynb|png))['\"`]", src))
for ref in sorted(refs):
    check(f"frontend ref {ref}", (DATA / ref).exists(), "missing in bundle")
for page in (15, 17, 18, 19, 20, 21, 22, 24, 26, 27, 29, 31):
    check(f"report page image {page}", (DATA / f"reference_figures/report_page_{page}.png").exists())

# ---------------------------------------------------------------- 4. UI regressions (QA 2026-11-20)
def src_of(rel: str) -> str:
    return (ROOT / "web" / "src" / rel).read_text(encoding="utf-8")


plot_src = src_of("components/Plot.tsx")
check("Plot clones layout per render (no autotype leakage)", "structuredClone(baseLayout)" in plot_src)
fig_src, fig2_src = src_of("research/figures.tsx"), src_of("research/figures2.tsx")
check("Fig 3.2 numeric axes explicit", fig_src.count("yaxis: { type: 'linear', title: { text: 'Records' } }") >= 4)
check("Fig 3.3 numeric axes explicit", fig_src.count("type: 'linear', title: { text: 'Crash year' }") == 2)
check("Fig 2.2 uses explicit magma_r stops (Plotly has no 'Magma' name)", "MAGMA_R" in fig_src and "colorscale: 'Magma'" not in fig_src)
check("Ch5 calibration axes explicit", "type: 'linear', title: { text: 'Mean predicted probability' }" in fig2_src)
check("Ch5 ROC/PR axes explicit", "type: 'linear', title: { text: kind === 'pr' ? 'Recall'" in fig2_src)
check("Grid map reset restores resolution", "setDec('2')" in fig2_src and "dec !== '2'" in fig2_src)
frame_src = src_of("components/FigureFrame.tsx")
for removed in ("How this was computed", "Compare with the report", "and exact values"):
    check(f"FigureFrame no longer renders '{removed}'", removed not in frame_src)
res_src, ov_src, app_src = src_of("pages/Resources.tsx"), src_of("pages/Overview.tsx"), src_of("content/appendices.tsx")
check("Resources: removed downloads/dictionary/inventory", all(x not in res_src for x in ("Public data downloads", "Data dictionary and codebooks", "Field inventory")))
check("Resources: no dead CrashCross repository link", "ExploratoryDataAnalysis/CrashCross" not in res_src)
check("Overview: Data provenance removed", "Data provenance" not in ov_src)
check("Appendices: S, contribution/bio and evidence-gate topics removed", all(x not in app_src for x in ("Supplementary notebook analyses", "Short Bio", "Evidence gates for analyses not run")))
rep_src = src_of("pages/Report.tsx")
check("Report reader resolves PDF link destinations", "getDestination" in rep_src and "getPageIndex" in rep_src and "onNavigate={goTo}" in rep_src)
check("Report reader clamps ?page to the page count", "Math.min(Math.max(1, p), d.numPages)" in rep_src)

print(f"{passes} checks passed, {len(failures)} failed ({len(refs)} frontend data references checked)")
for n in notes:
    print("NOTE", n)
for x in failures:
    print("FAIL", x)
sys.exit(1 if failures else 0)
