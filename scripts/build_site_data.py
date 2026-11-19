"""Build the static research data bundle for the CrashCross website.

Reads ONE explicitly identified, completed export run (default: v6-export-20261120-08),
verifies its completion marker and manifest hash, then copies only files whose manifest
``access`` classification is publishable into ``web/public/data``. Nothing here re-runs
research code, notebooks or models: files are copied byte-for-byte (CSV/PNG/PDF/IPYNB) or
re-serialised without changing values (JSON minification), plus a small number of clearly
labelled *display derivatives* (thinned ROC/PR curves, columnar grid arrays).

Usage (from repo root):
    python scripts/build_site_data.py [--export analysis/v6-export-20261120-08]

Outputs:
    web/public/data/...               published files (export-relative paths preserved)
    web/public/data/site_manifest.json provenance: run id, status, sha256 of every file,
                                       documented report differences, skipped/missing items
    docs/DATA_MAPPING.md (generated section between markers)
"""

from __future__ import annotations

import argparse
import csv
import fnmatch
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "data"
RUN_ID = "v6-export-20261120-08"

# Manifest access classes that may be published. "internal_review_only", "reference_review"
# (third-party codebook PDFs; linked at source instead) and unclassified files never are.
PUBLISHABLE = {"public_candidate_catalogue", "public_candidate_reference", "aggregate_review"}

# Patterns of export-relative paths to publish (subject to the access check above).
INCLUDE = [
    "chart_data/report_*/*.csv",
    "chart_data/report_*/*.json",
    "statistical_tables/association_*_contingency.*",
    "statistical_tables/association_*_expected.*",
    "statistical_tables/correlation_pairwise_n.*",
    "statistical_tables/findings_ledger.*",
    "model_evaluation/*_metrics.json",
    "model_evaluation/*_confusion_matrix.json",
    "model_evaluation/*_confusion_matrix.csv",
    "model_evaluation/*_queues.json",
    "model_evaluation/*_queues.csv",
    "model_evaluation/review_queues.*",
    "model_evaluation/enhanced_comparison.*",
    "model_evaluation/benchmark_comparison.*",
    "model_evaluation/threshold_results.*",
    "model_evaluation/temporal_ap_intervals.*",
    "model_evaluation/calibration_bin_counts.*",
    "model_evaluation/calibrated_reliability.*",
    "model_evaluation/permutation_importance.*",
    "model_evaluation/permutation_repeats.*",
    "model_evaluation/*_roc.csv",
    "model_evaluation/*_precision_recall.csv",
    "models/adjusted_association/coefficients.*",
    "models/adjusted_association/adjusted_or.*",
    "models/adjusted_association/rare_level_audit.*",
    "models/exploratory_kmeans/candidate_diagnostics.*",
    "models/exploratory_kmeans/profile*.*",
    "models/*/feature_importance.csv",
    "models/logistic_regression_plus_collision/coefficients.csv",
    "spatial/county_boundary.geojson",
    "spatial/rounded_grid_2.csv",
    "spatial/rounded_grid_3.csv",
    "spatial/coordinate_coverage.*",
    "spatial/candidate_coordinate_summary.*",
    "spatial/police_encoding_audit.*",
    "reference_figures/report_page_*.png",
    "resources/report.pdf",
    "resources/EDA_v6.ipynb",
    "resources/data_dictionary.csv",
    "resources/data_dictionary.json",
]
# Large JSON twins we never ship (CSV twin is shipped; browser uses derived arrays).
EXCLUDE = [
    "model_evaluation/*_roc.json",
    "model_evaluation/*_precision_recall.json",
    "spatial/rounded_grid_*.json",
    "*_schema.json",
]

CURVE_MODELS = [
    "logistic_regression_plus_collision",
    "random_forest_plus_collision",
    "random_forest_without_collision",
    "histgradientboosting_plus_collision",
    "temporally_calibrated_logistic",
    "benchmark_random_forest",
]
CURVE_MAX_POINTS = 1500

CATALOGUE_FIELDS = [
    "item_id", "report_identifier", "title", "chapter_or_appendix", "chapter_title",
    "report_pdf_pages_1_based", "report_printed_pages", "source_notebook_cell_indices",
    "item_kind", "calculation_description", "source_fields", "derived_fields",
    "filtering_rules", "year_range", "missing_value_handling", "numerator", "denominator",
    "units", "category_ordering", "display_rounding", "caveats", "verification_status",
    "verification_reason", "parent_item_id", "panel_or_layer",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fail(msg: str) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def load_json(path: Path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def verify_run(export: Path) -> dict:
    if (export / "INCOMPLETE.json").exists():
        fail(f"{export} has INCOMPLETE.json; refusing to use an unfinished run")
    complete_p = export / "COMPLETE.json"
    if not complete_p.exists():
        fail(f"{export} has no COMPLETE.json; run is not marked complete")
    complete = load_json(complete_p)
    if complete.get("run_id") != export.name:
        fail(f"COMPLETE.json run_id {complete.get('run_id')} != folder {export.name}")
    if not complete.get("required_checks_passed"):
        fail("COMPLETE.json says required checks did not pass")
    manifest_p = export / "manifest.json"
    actual = sha256(manifest_p)
    if actual != complete.get("manifest_sha256"):
        fail(f"manifest sha256 {actual} != COMPLETE.json {complete.get('manifest_sha256')}")
    manifest = load_json(manifest_p)
    if manifest.get("run_id") != export.name:
        fail("manifest run_id does not match folder")
    return {"complete": complete, "manifest": manifest}


def thin_curve(rows: list[dict], xk: str, yk: str, max_points: int) -> dict:
    """Keep first/last point and every point where the curve turns, then uniformly
    subsample the rest to max_points. Values are never altered, only omitted."""
    n = len(rows)
    xs = [float(r[xk]) for r in rows]
    ys = [float(r[yk]) for r in rows]
    keep = {0, n - 1}
    if n <= max_points:
        keep = set(range(n))
    else:
        step = n / (max_points - 2)
        i = 0.0
        while i < n:
            keep.add(int(i))
            i += step
    idx = sorted(keep)
    return {"x": [xs[i] for i in idx], "y": [ys[i] for i in idx], "source_points": n,
            "display_points": len(idx)}


def read_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", default=str(ROOT / "analysis" / RUN_ID))
    args = ap.parse_args()
    export = Path(args.export).resolve()
    if export.name != RUN_ID:
        print(f"WARNING: building from {export.name}, site code was mapped against {RUN_ID}")
    run = verify_run(export)
    manifest = run["manifest"]
    files = {f["path"]: f for f in manifest["files"]}

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    published, refused, missing_patterns = [], [], []
    for pattern in INCLUDE:
        matches = [p for p in files if fnmatch.fnmatch(p, pattern)
                   and not any(fnmatch.fnmatch(p, e) for e in EXCLUDE)]
        if not matches:
            missing_patterns.append(pattern)
        for rel in sorted(matches):
            entry = files[rel]
            access = entry.get("access")
            if access not in PUBLISHABLE:
                refused.append({"path": rel, "access": access})
                continue
            src = export / rel
            if not src.exists():
                refused.append({"path": rel, "access": access, "reason": "listed but missing"})
                continue
            digest = sha256(src)
            if digest != entry["sha256"]:
                fail(f"hash mismatch for {rel}")
            dst = OUT / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            if rel.endswith(".json") or rel.endswith(".geojson"):
                write_json(dst, load_json(src))  # minify only; values unchanged
                transform = "json_minified"
            else:
                shutil.copyfile(src, dst)
                transform = "byte_copy"
            published.append({"path": rel, "access": access, "source_sha256": digest,
                              "published_sha256": sha256(dst), "bytes": dst.stat().st_size,
                              "transform": transform})

    # ---- display derivatives -------------------------------------------------------
    derived = []
    curves = {}
    for model in CURVE_MODELS:
        roc_p = export / f"model_evaluation/{model}_roc.csv"
        pr_p = export / f"model_evaluation/{model}_precision_recall.csv"
        if files.get(roc_p.relative_to(export).as_posix(), {}).get("access") not in PUBLISHABLE:
            continue
        roc = thin_curve(read_csv(roc_p), "false_positive_rate", "true_positive_rate", CURVE_MAX_POINTS)
        pr_rows = read_csv(pr_p)
        pr = thin_curve(pr_rows, "recall", "precision", CURVE_MAX_POINTS)
        curves[model] = {"roc": roc, "pr": pr}
    write_json(OUT / "derived/curves.json", {
        "note": "Display derivative: points omitted (never altered) to at most "
                f"{CURVE_MAX_POINTS} per curve; full-resolution CSVs are published alongside.",
        "curves": curves})
    derived.append("derived/curves.json")

    for g in (2, 3):
        rows = read_csv(export / f"spatial/rounded_grid_{g}.csv")
        write_json(OUT / f"derived/rounded_grid_{g}.json", {
            "decimals": g,
            "note": "Columnar copy of spatial/rounded_grid_%d.csv (values unchanged). Bins are "
                    "pandas round-to-%d-decimal coordinate groups, not the Figure 4.1 hexbin." % (g, g),
            "lat": [float(r["LAT_BIN"]) for r in rows],
            "lon": [float(r["LON_BIN"]) for r in rows],
            "count": [int(r["crash_count"]) for r in rows],
            "years": [int(r["years_observed"]) for r in rows]})
        derived.append(f"derived/rounded_grid_{g}.json")

    # ---- catalogue subset ------------------------------------------------------------
    cat = load_json(export / "catalogue.json")
    published_paths = {p["path"] for p in published}
    items = {}
    for ch in cat["chapters"]:
        data = load_json(export / ch["path"])
        for it in data["items"]:
            if it.get("item_kind") not in ("computed_result", "panel_or_layer",
                                           "computed_report_finding", "notebook_only_supplementary"):
                continue
            sub = {k: it.get(k) for k in CATALOGUE_FIELDS if k in it}
            sub["published_paths"] = [p for p in it.get("new_export_paths", []) if p in published_paths]
            sub["unpublished_paths"] = [p for p in it.get("new_export_paths", []) if p not in published_paths]
            items[it["item_id"]] = sub
    write_json(OUT / "derived/catalogue_items.json", items)
    derived.append("derived/catalogue_items.json")

    differences = manifest.get("incomplete_or_different_checks", [])
    site_manifest = {
        "run_id": export.name,
        "status": run["complete"]["status"],
        "completed_utc": run["complete"]["completed_utc"],
        "manifest_sha256": run["complete"]["manifest_sha256"],
        "review_status": manifest.get("review_status"),
        "publication_policy": {
            "publishable_access_classes": sorted(PUBLISHABLE),
            "never_published": "internal_review_only, reference_review, unclassified; model "
                               "binaries, record-level data, scores, source identifiers",
        },
        "documented_report_differences": differences,
        "scientific_boundaries": manifest.get("scientific_boundaries", []),
        "published_files": published,
        "derived_files": derived,
        "refused_files": refused,
        "patterns_without_matches": missing_patterns,
    }
    write_json(OUT / "site_manifest.json", site_manifest)
    total = sum(p["bytes"] for p in published)
    print(f"run {export.name}: published {len(published)} files ({total/1e6:.1f} MB), "
          f"{len(derived)} derivatives, refused {len(refused)}, empty patterns {missing_patterns}")
    for r in refused:
        print("  refused:", r)


if __name__ == "__main__":
    main()
