"""Dataset overview and quality checks computed from the uploaded DataFrame."""

from __future__ import annotations

import re

import numpy as np
import pandas as pd

from .util import clean

MAX_CORR_COLUMNS = 15


_ID_NAME = re.compile(r"(^|[_\s-])(id|uid|uuid|guid|key|crn|zip|zipcode|postcode|phone|ssn|account|serial)$|^(id|uid|uuid)[_\s-]|(_no|_num)$", re.I)
_CODE_NAME = re.compile(r"(^|[_\s-])(code|cd|type|class|category|status|group)$", re.I)


def column_kind(s: pd.Series, n_rows: int) -> str:
    """Analytical role guess: numeric, categorical, datetime, boolean, text or identifier.

    Identifiers: name looks like an id/key/zip/phone and >= 90% of values are distinct, or (any name)
    every value is distinct in >= 20 rows and the values are text or consecutive-looking integers.
    Ordinary numeric measurements (floats, or integers with repeats) stay numeric. Integer columns
    named like a code/type/group with at most 20 levels are treated as categorical labels.
    """
    if pd.api.types.is_bool_dtype(s) or str(s.dtype) == "boolean":
        return "boolean"
    if pd.api.types.is_datetime64_any_dtype(s):
        return "datetime"
    nn = s.dropna()
    n = len(nn)
    nunique = int(nn.nunique())
    name = str(s.name or "")
    ratio = nunique / n if n else 0
    is_int = pd.api.types.is_integer_dtype(nn) or (pd.api.types.is_float_dtype(nn) and n and bool((nn == nn.round()).all()))
    if pd.api.types.is_numeric_dtype(s):
        if n >= 10 and is_int and _ID_NAME.search(name) and ratio >= 0.9:
            return "identifier"
        if n >= 20 and pd.api.types.is_integer_dtype(nn) and nunique == n and (nn.max() - nn.min() + 1) <= 2 * n:
            return "identifier"  # e.g. 1001..1250 row numbers
        if is_int and _CODE_NAME.search(name) and nunique <= 20:
            return "categorical"
        return "numeric"
    if n >= 10 and _ID_NAME.search(name) and ratio >= 0.9:
        return "identifier"
    if n >= 20 and nunique == n:
        avg_len = nn.astype(str).str.len().mean()
        return "text" if avg_len > 30 else "identifier"
    if n:
        avg_len = nn.astype(str).str.len().mean()
        if nunique > 0.5 * n and avg_len > 30:
            return "text"
    return "categorical"


def numeric_summary(s: pd.Series) -> dict:
    x = pd.to_numeric(s, errors="coerce").dropna()
    if x.empty:
        return {}
    q1, q3 = x.quantile([0.25, 0.75])
    iqr = q3 - q1
    outliers = int(((x < q1 - 1.5 * iqr) | (x > q3 + 1.5 * iqr)).sum()) if iqr > 0 else 0
    return clean({
        "mean": x.mean(), "std": x.std(), "min": x.min(), "q1": q1, "median": x.median(), "q3": q3, "max": x.max(),
        "skew": x.skew() if len(x) > 2 else None, "zeros": int((x == 0).sum()), "iqr_outliers": outliers,
    })


def build_overview(df: pd.DataFrame) -> dict:
    n = len(df)
    columns = []
    warnings: list[dict] = []
    dup_rows = int(df.duplicated().sum())
    for c in df.columns:
        s = df[c]
        kind = column_kind(s, n)
        missing = int(s.isna().sum())
        nunique = int(s.nunique(dropna=True))
        info = {
            "name": c, "dtype": str(s.dtype), "kind": kind, "missing": missing,
            "missing_percent": 100 * missing / n if n else 0, "unique": nunique,
        }
        if kind == "numeric":
            info["stats"] = numeric_summary(s)
            if info["stats"].get("iqr_outliers", 0) > 0.05 * (n - missing) and n - missing >= 20:
                warnings.append({"column": c, "kind": "outliers", "severity": "info",
                                 "message": f"{info['stats']['iqr_outliers']:,} values ({100 * info['stats']['iqr_outliers'] / (n - missing):.1f}%) lie outside 1.5×IQR. Check before treating them as errors."})
        elif kind == "datetime":
            nn = s.dropna()
            info["stats"] = clean({"min": nn.min() if len(nn) else None, "max": nn.max() if len(nn) else None})
        if kind in ("categorical", "boolean"):
            vc = s.astype("object").where(s.notna(), None).value_counts(dropna=True).head(10)
            info["top_values"] = [{"value": clean(k), "count": int(v)} for k, v in vc.items()]
            if kind == "categorical" and nunique > 50:
                warnings.append({"column": c, "kind": "high_cardinality", "severity": "info",
                                 "message": f"{nunique:,} distinct values; charts show only the most frequent categories."})
        info["sample"] = clean(s.dropna().head(3).tolist())
        if missing / n > 0.5 if n else False:
            warnings.append({"column": c, "kind": "missing", "severity": "warning",
                             "message": f"{100 * missing / n:.1f}% of values are missing."})
        elif n and missing / n > 0.2:
            warnings.append({"column": c, "kind": "missing", "severity": "info",
                             "message": f"{100 * missing / n:.1f}% of values are missing."})
        if nunique == 1 and n > 1:
            warnings.append({"column": c, "kind": "constant", "severity": "info", "message": "Only one distinct value."})
        if kind == "identifier":
            warnings.append({"column": c, "kind": "identifier", "severity": "info",
                             "message": "Every value is distinct — likely an identifier; excluded from averages and correlations by default."})
        if s.dtype == object:
            nn = s.dropna().astype(str)
            if len(nn):
                share = pd.to_numeric(nn.str.replace(",", "", regex=False), errors="coerce").notna().mean()
                if 0.3 <= share < 0.98:
                    warnings.append({"column": c, "kind": "mixed_types", "severity": "warning",
                                     "message": f"{100 * share:.0f}% of values look numeric and the rest do not — mixed types."})
        columns.append(clean(info))
    if dup_rows:
        warnings.insert(0, {"column": None, "kind": "duplicates", "severity": "warning",
                            "message": f"{dup_rows:,} rows are exact duplicates of an earlier row."})
    complete_rows = int(df.notna().all(axis=1).sum())
    return {
        "rows": n,
        "columns": len(df.columns),
        "memory_mb": round(float(df.memory_usage(deep=True).sum()) / 1e6, 2),
        "duplicate_rows": dup_rows,
        "complete_rows": complete_rows,
        "missing_cells": int(df.isna().sum().sum()),
        "column_info": columns,
        "warnings": warnings,
        "kinds": {k: [c["name"] for c in columns if c["kind"] == k] for k in ("numeric", "categorical", "datetime", "boolean", "text", "identifier")},
    }


def correlation(df: pd.DataFrame, cols: list[str], method: str = "pearson") -> dict:
    if method not in ("pearson", "spearman"):
        raise ValueError("Correlation method must be pearson or spearman.")
    cols = [c for c in cols if c in df.columns][:MAX_CORR_COLUMNS]
    if len(cols) < 2:
        raise ValueError("Correlation needs at least two numeric columns.")
    sub = df[cols].apply(pd.to_numeric, errors="coerce")
    mat = sub.corr(method=method, min_periods=3)
    notna = sub.notna().astype(int)
    pair_n = notna.T.dot(notna)
    return {"columns": cols, "method": method, "matrix": clean(mat.values), "pairwise_n": clean(pair_n.values)}


def preview(df: pd.DataFrame, offset: int, limit: int) -> dict:
    limit = max(1, min(limit, 200))
    part = df.iloc[offset: offset + limit]
    return {"offset": offset, "limit": limit, "total": len(df), "columns": list(df.columns),
            "rows": [clean(r) for r in part.to_dict(orient="records")]}


def strongest_pairs(corr: dict, k: int = 10) -> list[dict]:
    cols, m, n = corr["columns"], corr["matrix"], corr["pairwise_n"]
    out = []
    for i in range(len(cols)):
        for j in range(i + 1, len(cols)):
            if m[i][j] is not None:
                out.append({"a": cols[i], "b": cols[j], "r": m[i][j], "n": n[i][j]})
    out.sort(key=lambda d: -abs(d["r"]))
    return out[:k]


__all__ = ["build_overview", "correlation", "preview", "column_kind", "strongest_pairs", "np"]
