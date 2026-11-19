"""Approved, deterministic analysis operations the chat planner may request.

The language model only chooses an operation and its column arguments; every number comes
from these functions. No model-generated code is executed.
"""

from __future__ import annotations

from typing import Any, Callable

import pandas as pd

from .charts import AGGS, ChartError, build_chart
from .profile import column_kind, correlation, numeric_summary, strongest_pairs
from .util import clean


class OpError(ValueError):
    pass


def _col(df: pd.DataFrame, name: Any) -> str:
    if not isinstance(name, str) or name not in df.columns:
        raise OpError(f'Column "{name}" does not exist in this dataset.')
    return name


def op_overview(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    cols = [{"column": c["name"], "kind": c["kind"], "missing_percent": round(c["missing_percent"], 2), "unique": c["unique"]}
            for c in ov["column_info"]]
    return {"title": "Dataset overview", "facts": {"rows": ov["rows"], "columns": ov["columns"], "duplicate_rows": ov["duplicate_rows"],
            "complete_rows": ov["complete_rows"], "missing_cells": ov["missing_cells"]},
            "table": {"columns": ["column", "kind", "missing_percent", "unique"], "rows": cols}}


def op_describe(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    c = _col(df, p.get("column"))
    kind = column_kind(df[c], len(df))
    s = df[c]
    facts = {"column": c, "kind": kind, "rows": len(df), "missing": int(s.isna().sum()), "unique": int(s.nunique())}
    if kind == "numeric":
        facts.update(numeric_summary(s))
        return {"title": f"Summary of {c}", "facts": clean(facts)}
    vc = s.astype(object).where(s.notna(), "(missing)").value_counts().head(15)
    return {"title": f"Summary of {c}", "facts": clean(facts),
            "table": {"columns": ["value", "count", "percent"],
                      "rows": clean([{"value": k, "count": int(v), "percent": 100 * v / len(df)} for k, v in vc.items()])}}


def op_value_counts(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    c = _col(df, p.get("column"))
    top = int(p.get("top_n") or 15)
    top = max(1, min(top, 50))
    s = df[c].astype(object).where(df[c].notna(), "(missing)")
    vc = s.value_counts()
    rows = [{"value": k, "count": int(v), "percent": 100 * v / len(df)} for k, v in vc.head(top).items()]
    return {"title": f"Most frequent values of {c}", "facts": {"column": c, "distinct_values": int(df[c].nunique()), "rows": len(df),
            "shown": len(rows)}, "table": {"columns": ["value", "count", "percent"], "rows": clean(rows)}}


def op_group_aggregate(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    g = _col(df, p.get("group_by"))
    agg = p.get("agg") or "mean"
    if agg not in AGGS:
        raise OpError(f"Aggregation must be one of {', '.join(AGGS)}.")
    t = p.get("target")
    if agg != "count":
        t = _col(df, t)
        if column_kind(df[t], len(df)) != "numeric":
            raise OpError(f'"{t}" is not numeric, so it cannot be averaged or summed.')
    top = max(1, min(int(p.get("top_n") or 20), 50))
    keys = df[g].astype(object).where(df[g].notna(), "(missing)")
    if agg == "count":
        res = keys.value_counts().rename("value")
    else:
        res = getattr(df[t].groupby(keys), agg)().rename("value")
        res = res.sort_values(ascending=False)
    n = df[t].groupby(keys).count() if agg != "count" else res
    rows = [{"group": k, "value": v, "n": int(n.get(k, 0))} for k, v in res.head(top).items()]
    title = f"{agg} of {t} by {g}" if agg != "count" else f"Row count by {g}"
    return {"title": title, "facts": {"group_by": g, "target": t if agg != "count" else None, "agg": agg, "groups": int(len(res)),
            "shown": len(rows)}, "table": {"columns": ["group", "value", "n"], "rows": clean(rows)}}


def op_correlation(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    cols = p.get("columns") or ov["kinds"]["numeric"]
    cols = [_col(df, c) for c in cols]
    method = p.get("method") or "pearson"
    try:
        corr = correlation(df, cols, method)
    except ValueError as e:
        raise OpError(str(e)) from None
    pairs = strongest_pairs(corr, 10)
    return {"title": f"Strongest {method} correlations", "facts": {"method": method, "columns_considered": len(corr["columns"])},
            "table": {"columns": ["a", "b", "r", "n"], "rows": pairs}}


def op_missingness(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    rows = sorted(({"column": c["name"], "missing": c["missing"], "missing_percent": c["missing_percent"]} for c in ov["column_info"]),
                  key=lambda r: -r["missing"])
    top = max(1, min(int(p.get("top_n") or 15), 50))
    return {"title": "Missing values by column", "facts": {"rows": ov["rows"], "missing_cells": ov["missing_cells"], "complete_rows": ov["complete_rows"]},
            "table": {"columns": ["column", "missing", "missing_percent"], "rows": clean(rows[:top])}}


def op_crosstab(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    r, c = _col(df, p.get("row")), _col(df, p.get("col"))
    if df[r].nunique() > 20 or df[c].nunique() > 20:
        raise OpError("Cross-tabulations are limited to columns with at most 20 categories each.")
    ct = pd.crosstab(df[r], df[c])
    rows = [{"row": k, **{str(col): int(v) for col, v in row.items()}} for k, row in ct.iterrows()]
    return {"title": f"Counts of {r} × {c}", "facts": {"row": r, "col": c, "rows_counted": int(ct.values.sum())},
            "table": {"columns": ["row"] + [str(x) for x in ct.columns], "rows": clean(rows)}}


def op_chart(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    spec = {k: p.get(k) for k in ("chart_type", "x", "y", "color", "agg", "bins", "top_n", "interval", "columns", "method")}
    try:
        res = build_chart(df, spec)
    except ChartError as e:
        raise OpError(str(e)) from None
    res["facts"] = {"rows_used": res["rows_used"], "rows_total": res["rows_total"]}
    return res


OPERATIONS: dict[str, tuple[Callable[[pd.DataFrame, dict, dict], dict], str]] = {
    "overview": (op_overview, "Shape, duplicate rows, and each column's kind, missing % and distinct count. params: {}"),
    "describe_column": (op_describe, "Summary statistics (numeric) or category frequencies of one column. params: {column}"),
    "value_counts": (op_value_counts, "Most frequent values of a column. params: {column, top_n?}"),
    "group_aggregate": (op_group_aggregate, "Aggregate a numeric target by a categorical group (agg: count|sum|mean|median|min|max). params: {group_by, target?, agg, top_n?}"),
    "correlation": (op_correlation, "Strongest pairwise correlations among numeric columns. params: {columns?, method: pearson|spearman}"),
    "missingness": (op_missingness, "Columns with the most missing values. params: {top_n?}"),
    "crosstab": (op_crosstab, "Count table of two categorical columns (≤ 20 categories each). params: {row, col}"),
    "chart": (op_chart, "Draw a chart. params: {chart_type: histogram|bar|line|scatter|box|heatmap, x?, y?, color?, agg?, bins?, top_n?, interval?, columns?, method?}"),
}


def run_operation(name: str, df: pd.DataFrame, overview: dict, params: dict) -> dict:
    if name not in OPERATIONS:
        raise OpError(f'"{name}" is not an approved operation.')
    out = OPERATIONS[name][0](df, overview, params or {})
    out.setdefault("kind", "analysis")
    out["operation"] = name
    out["params"] = clean(params or {})
    return out
