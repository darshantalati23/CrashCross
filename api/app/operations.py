"""Approved, deterministic analysis operations the chat planner may request.

The language model only chooses an operation and its column arguments; every number comes
from these functions. No model-generated code is executed.
"""

from __future__ import annotations

import math
from decimal import Decimal, InvalidOperation
from typing import Any, Callable

import pandas as pd

from .charts import AGGS, ChartError, build_chart
from .profile import build_overview, column_kind, correlation, numeric_summary, strongest_pairs
from .util import clean


class OpError(ValueError):
    pass


def _col(df: pd.DataFrame, name: Any) -> str:
    if not isinstance(name, str) or name not in df.columns:
        raise OpError(f'Column "{name}" does not exist in this dataset.')
    return name


def _text(s: pd.Series) -> pd.Series:
    return s.astype("string").str.normalize("NFKC").str.casefold().str.replace(r"\s+", " ", regex=True).str.strip()


def filter_rows(df: pd.DataFrame, filters: Any, mode: str = "all") -> pd.DataFrame:
    """Validated filters scan the complete table, never a preview or a top-N result."""
    if not isinstance(filters, list) or len(filters) > 10 or mode not in ("all", "any"):
        raise OpError("Use up to 10 filters with filter_mode 'all' or 'any'.")
    if not filters:
        return df
    mask = pd.Series(mode == "all", index=df.index)
    for f in filters:
        if not isinstance(f, dict) or set(f) - {"column", "op", "value"}:
            raise OpError("Each filter needs column, op and value (except is_null/not_null).")
        c = _col(df, f.get("column"))
        op, value, s = f.get("op"), f.get("value"), df[c]
        if op in ("is_null", "not_null"):
            hit = s.isna() if op == "is_null" else s.notna()
        else:
            values = value if op == "in" else [value]
            if not isinstance(values, list) or not 1 <= len(values) <= 100 or any(
                not isinstance(v, (str, int, float, bool)) or isinstance(v, str) and len(v) > 500
                or isinstance(v, float) and not math.isfinite(v) for v in values
            ):
                raise OpError("Filter values must be text, numbers or booleans; use is_null for missing values.")
            if op in ("contains", "starts_with"):
                if not isinstance(value, str) or not value.strip():
                    raise OpError("Text search needs a non-empty value.")
                target = _text(pd.Series([value])).iloc[0]
                text = _text(s)
                hit = text.str.contains(target, regex=False, na=False) if op == "contains" else text.str.startswith(target, na=False)
            elif op in ("eq", "ne", "in", "gt", "gte", "lt", "lte"):
                if pd.api.types.is_bool_dtype(s):
                    values = [v.strip().casefold() == "true" if isinstance(v, str) and v.strip().casefold() in ("true", "false") else v for v in values]
                    if any(not isinstance(v, bool) for v in values) or op not in ("eq", "ne", "in"):
                        raise OpError("Boolean columns need true/false equality filters.")
                    target, source = values, s
                elif pd.api.types.is_numeric_dtype(s):
                    if any(isinstance(v, bool) for v in values):
                        raise OpError("Numeric filters need finite numbers.")
                    try:
                        numbers = [Decimal(str(v)) for v in values]
                        if not all(v.is_finite() and (v.is_zero() or -323 <= v.adjusted() <= 308) for v in numbers):
                            raise ValueError
                        # Keep integer identifiers exact above 2**53; float coercion can match a neighbour.
                        target = [int(v) if v == v.to_integral_value() else float(v) for v in numbers]
                    except (InvalidOperation, ValueError, TypeError, OverflowError):
                        raise OpError("Numeric filters need finite numbers.") from None
                    if not all(not isinstance(v, float) or math.isfinite(v) for v in target):
                        raise OpError("Numeric filters need finite numbers.")
                    source = s
                elif pd.api.types.is_datetime64_any_dtype(s):
                    try:
                        target = [pd.Timestamp(v) for v in values if isinstance(v, str)]
                        if len(target) != len(values) or any(pd.isna(v) for v in target):
                            raise ValueError
                    except (ValueError, TypeError):
                        raise OpError("Date filters need valid date strings.") from None
                    source = s
                else:
                    if op not in ("eq", "ne", "in"):
                        raise OpError("Use equality or text search for text columns; ordered comparisons need numbers or dates.")
                    target, source = _text(pd.Series(values)).tolist(), _text(s)
                try:
                    if op == "in":
                        hit = source.isin(target)
                    else:
                        hit = getattr(source, {"gte": "ge", "lte": "le"}.get(op, op))(target[0])
                except (TypeError, ValueError):
                    raise OpError(f'The filter value cannot be compared with "{c}".') from None
                hit = hit & s.notna()  # missing values never silently satisfy ne/comparisons
            else:
                raise OpError(f"Unknown filter operator '{op}'.")
        hit = hit.fillna(False)
        mask = mask & hit if mode == "all" else mask | hit
    return df.loc[mask]


def _integer(value: Any, name: str, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise OpError(f"{name} must be an integer between {low} and {high}.")
    return value


def op_lookup_rows(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    columns = p.get("columns", list(df.columns)[:20])
    if not isinstance(columns, list) or not 1 <= len(columns) <= 20:
        raise OpError("Select between 1 and 20 output columns.")
    columns = list(dict.fromkeys(_col(df, c) for c in columns))
    # Keep search fields and likely identifiers visible so duplicate names are not merged.
    identity = [f["column"] for f in p.get("filters", [])] + [c["name"] for c in ov["column_info"] if c["kind"] == "identifier"][:3]
    columns = list(dict.fromkeys(identity + columns))
    limit = _integer(p.get("limit", 50), "limit", 1, 100)
    offset = _integer(p.get("offset", 0), "offset", 0, 200_000)
    if "sort_desc" in p and type(p["sort_desc"]) is not bool:
        raise OpError("sort_desc must be true or false.")
    if p.get("sort_by") is not None:
        c = _col(df, p["sort_by"])
        df = df.sort_values(c, ascending=not p.get("sort_desc", False), kind="stable", na_position="last")
    part = df.iloc[offset:offset + limit][columns]
    return {"title": "Matching records", "total_results": len(df),
            "facts": {"matches": len(df), "returned": len(part), "offset": offset},
            "table": {"columns": columns, "rows": clean(part.to_dict(orient="records"))}}


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
    return {"title": f"Summary of {c}", "facts": clean(facts), "total_results": int(s.nunique(dropna=False)),
            "table": {"columns": ["value", "count", "percent"],
                      "rows": clean([{"value": k, "count": int(v), "percent": 100 * v / len(df)} for k, v in vc.items()])}}


def op_value_counts(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    c = _col(df, p.get("column"))
    top = int(p.get("top_n") or 15)
    top = max(1, min(top, 50))
    s = df[c].astype(object).where(df[c].notna(), "(missing)")
    vc = s.value_counts()
    rows = [{"value": k, "count": int(v), "percent": 100 * v / len(df)} for k, v in vc.head(top).items()]
    return {"title": f"Most frequent values of {c}", "total_results": len(vc), "facts": {"column": c, "distinct_values": int(df[c].nunique()), "rows": len(df),
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
    return {"title": title, "total_results": len(res), "facts": {"group_by": g, "target": t if agg != "count" else None, "agg": agg, "groups": int(len(res)),
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
    total = sum(corr["matrix"][i][j] is not None for i in range(len(corr["columns"])) for j in range(i + 1, len(corr["columns"])))
    return {"title": f"Strongest {method} correlations", "total_results": total, "facts": {"method": method, "columns_considered": len(corr["columns"])},
            "table": {"columns": ["a", "b", "r", "n"], "rows": pairs}}


def op_missingness(df: pd.DataFrame, ov: dict, p: dict) -> dict:
    rows = sorted(({"column": c["name"], "missing": c["missing"], "missing_percent": c["missing_percent"]} for c in ov["column_info"]),
                  key=lambda r: -r["missing"])
    top = max(1, min(int(p.get("top_n") or 15), 50))
    return {"title": "Missing values by column", "total_results": len(rows), "facts": {"rows": ov["rows"], "missing_cells": ov["missing_cells"], "complete_rows": ov["complete_rows"]},
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
    "lookup_rows": (op_lookup_rows, "Find records or rank/sort rows. Filter the FULL dataset first. params: {filters?, filter_mode?: all|any, columns?: [names], sort_by?, sort_desc?: boolean, limit?: 1..100, offset?: integer}. Preserve duplicate matches; include identifying columns."),
    "overview": (op_overview, "Shape, duplicate rows, and each column's kind, missing % and distinct count. params: {}"),
    "describe_column": (op_describe, "Summary statistics (numeric) or category frequencies of one column. params: {column}"),
    "value_counts": (op_value_counts, "Most frequent values of a column. params: {column, top_n?}"),
    "group_aggregate": (op_group_aggregate, "Aggregate a numeric target by a categorical group (agg: count|sum|mean|median|min|max). params: {group_by, target?, agg, top_n?}"),
    "correlation": (op_correlation, "Strongest pairwise correlations among numeric columns. params: {columns?, method: pearson|spearman}"),
    "missingness": (op_missingness, "Columns with the most missing values. params: {top_n?}"),
    "crosstab": (op_crosstab, "Count table of two categorical columns (≤ 20 categories each). params: {row, col}"),
    "chart": (op_chart, "Draw a chart. params: {chart_type: histogram|bar|line|scatter|box|heatmap, x?, y?, color?, agg?, bins?, top_n?, interval?, columns?, method?}"),
}

_PARAMS = {
    "lookup_rows": {"columns", "sort_by", "sort_desc", "limit", "offset"}, "overview": set(),
    "describe_column": {"column"}, "value_counts": {"column", "top_n"},
    "group_aggregate": {"group_by", "target", "agg", "top_n"}, "correlation": {"columns", "method"},
    "missingness": {"top_n"}, "crosstab": {"row", "col"},
    "chart": {"chart_type", "x", "y", "color", "agg", "bins", "top_n", "interval", "columns", "method"},
}


def run_operation(name: str, df: pd.DataFrame, overview: dict, params: dict) -> dict:
    if not isinstance(name, str) or name not in OPERATIONS:
        raise OpError(f'"{name}" is not an approved operation.')
    if not isinstance(params, dict) or set(params) - (_PARAMS[name] | {"filters", "filter_mode"}):
        raise OpError("The query contains unsupported parameters; use the documented operation and filters.")
    for k in ("top_n", "bins"):
        if k in params:
            _integer(params[k], k, 1, 100 if k == "bins" else 50)
    if "columns" in params and (not isinstance(params["columns"], list) or any(not isinstance(c, str) for c in params["columns"])):
        raise OpError("columns must be a list of column names.")
    total_rows = len(df)
    selected = filter_rows(df, params.get("filters", []), params.get("filter_mode", "all"))
    ov = build_overview(selected) if params.get("filters") and name in ("overview", "describe_column", "correlation", "missingness") else overview
    out = OPERATIONS[name][0](selected, ov, params)
    returned = len(out.get("table", {}).get("rows", []))
    total_results = out.get("total_results", returned)
    truncated = returned < total_results
    out["evidence"] = {"rows_searched": total_rows, "rows_matched": len(selected), "search_complete": True,
                       "results_total": total_results, "results_returned": returned, "output_truncated": truncated}
    notes = out.setdefault("notes", [])
    notes.append(f"Searched all {total_rows:,} uploaded rows; {len(selected):,} rows match the filters.")
    if truncated:
        notes.append(f"Showing {returned:,} of {total_results:,} results. Absence from this partial table does not mean absence from the dataset.")
    if name == "lookup_rows" and len(selected) > 1:
        notes.append("Multiple records match. They are kept separate; use an identifier or additional filters to select a person uniquely.")
    if name == "lookup_rows" and not len(selected):
        notes.append("No records match these filters. Text equality ignores case and repeated spaces; try contains for a partial name or check spelling.")
    out.setdefault("kind", "analysis")
    out["operation"] = name
    out["params"] = clean(params or {})
    return out
