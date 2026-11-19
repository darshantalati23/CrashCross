"""Configurable charts: validate a chart spec against column kinds, aggregate server-side,
and return a Plotly figure plus the exact table it was drawn from.

Chart types and their requirements:
  histogram  x numeric                     [color categorical ≤ 8 levels]  bins 5–100
  bar        x categorical/boolean (or numeric with ≤ 30 distinct values)
             y optional numeric + agg (count|sum|mean|median|min|max)       [color ≤ 8]  top_n
  line       x datetime or numeric; y optional numeric + agg; interval for dates [color ≤ 8]
  scatter    x numeric, y numeric           [color ≤ 8]  (sampled to 5,000 points, stated)
  box        y numeric                      [x categorical ≤ 20 levels]
  heatmap    columns: 2–15 numeric, method pearson|spearman
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from .profile import column_kind, correlation
from .util import clean

CHART_TYPES = ("histogram", "bar", "line", "scatter", "box", "heatmap")
AGGS = ("count", "sum", "mean", "median", "min", "max")
INTERVALS = {"day": "D", "week": "W", "month": "MS", "quarter": "QS", "year": "YS"}
PALETTE = ["#1f5f8b", "#c0692b", "#5a8f5a", "#8172b3", "#c44e52", "#937860", "#da8bc3", "#8c8c8c"]
MAX_COLOR_LEVELS = 8
SCATTER_MAX = 5000
MISSING_LABEL = "(missing)"


class ChartError(ValueError):
    pass


def _kind(df: pd.DataFrame, col: str) -> str:
    if col not in df.columns:
        raise ChartError(f'Column "{col}" does not exist in this dataset.')
    return column_kind(df[col], len(df))


def _need(df: pd.DataFrame, col: str | None, allowed: set[str], role: str, chart: str) -> str:
    if not col:
        raise ChartError(f"A {chart} chart needs a {role} column.")
    k = _kind(df, col)
    if k not in allowed:
        nice = " or ".join(sorted(allowed))
        raise ChartError(f'"{col}" is {k}; the {role} of a {chart} chart must be {nice}.')
    return k


def _color_levels(df: pd.DataFrame, color: str | None) -> list | None:
    if not color:
        return None
    k = _kind(df, color)
    if k not in ("categorical", "boolean"):
        raise ChartError(f'Colour grouping needs a categorical column; "{color}" is {k}.')
    levels = df[color].dropna().unique().tolist()
    if len(levels) > MAX_COLOR_LEVELS:
        raise ChartError(f'"{color}" has {len(levels)} categories; colour grouping supports at most {MAX_COLOR_LEVELS}. Filter or choose another column.')
    try:
        return sorted(levels)
    except TypeError:
        return levels


def _agg(series: pd.core.groupby.SeriesGroupBy | pd.Series, agg: str):
    return getattr(series, agg)() if agg != "count" else series.count()


def _layout(title: str, xt: str, yt: str, **extra) -> dict:
    lay = {"title": {"text": title}, "xaxis": {"title": {"text": xt}}, "yaxis": {"title": {"text": yt}},
           "margin": {"l": 60, "r": 20, "t": 50, "b": 60}, "legend": {"orientation": "h", "y": -0.2}}
    lay.update(extra)
    return lay


def build_chart(df: pd.DataFrame, spec: dict[str, Any]) -> dict:
    ct = spec.get("chart_type")
    if ct not in CHART_TYPES:
        raise ChartError(f"Unknown chart type. Choose one of: {', '.join(CHART_TYPES)}.")
    x, y, color = spec.get("x") or None, spec.get("y") or None, spec.get("color") or None
    agg = spec.get("agg") or ("count" if not y else "mean")
    if agg not in AGGS:
        raise ChartError(f"Unknown aggregation. Choose one of: {', '.join(AGGS)}.")
    if agg != "count" and not y and ct in ("bar", "line"):
        raise ChartError(f'Aggregation "{agg}" needs a numeric Y column; use "count" to count rows.')
    if ct in ("bar", "line", "scatter") and x and y and x == y:
        raise ChartError("X and Y must be different columns.")
    notes: list[str] = []
    n_total = len(df)

    if ct == "histogram":
        _need(df, x, {"numeric"}, "X", "histogram")
        bins = int(spec.get("bins") or 30)
        if not 5 <= bins <= 100:
            raise ChartError("Bins must be between 5 and 100.")
        levels = _color_levels(df, color)
        cols = [x] + ([color] if color else [])
        sub = df[cols].dropna(subset=[x])
        vals = pd.to_numeric(sub[x], errors="coerce")
        edges = np.histogram_bin_edges(vals, bins=bins)
        traces, rows = [], []
        groups = [(None, vals)] if not levels else [(lv, vals[sub[color] == lv]) for lv in levels]
        for i, (lv, v) in enumerate(groups):
            counts, _ = np.histogram(v, bins=edges)
            centers = (edges[:-1] + edges[1:]) / 2
            traces.append({"type": "bar", "x": clean(centers), "y": clean(counts), "width": clean(np.diff(edges)),
                           "name": str(lv) if lv is not None else x, "marker": {"color": PALETTE[i % 8]}, "opacity": 0.75 if levels else 1,
                           "customdata": clean(np.column_stack([edges[:-1], edges[1:]])),
                           "hovertemplate": "[%{customdata[0]:.4g}, %{customdata[1]:.4g}): %{y:,} rows<extra>%{fullData.name}</extra>"})
            for a, b, c in zip(edges[:-1], edges[1:], counts):
                rows.append({"group": lv, "bin_start": a, "bin_end": b, "count": int(c)})
        used = len(sub)
        fig = {"data": traces, "layout": _layout(f"Distribution of {x}", x, "Rows", barmode="overlay" if levels else "group", bargap=0)}
        table_cols = (["group"] if levels else []) + ["bin_start", "bin_end", "count"]
        if not levels:
            rows = [{k: r[k] for k in table_cols} for r in rows]

    elif ct in ("bar", "line"):
        if ct == "bar":
            kx = _kind(df, x) if x else None
            if not x:
                raise ChartError("A bar chart needs an X (category) column.")
            if kx == "numeric" and df[x].nunique() > 30:
                raise ChartError(f'"{x}" is numeric with {df[x].nunique():,} distinct values; use a histogram, or a categorical X.')
            if kx in ("text", "datetime"):
                raise ChartError(f'"{x}" is {kx}; bar charts need a categorical X. Use a line chart for dates.')
        else:
            kx = _need(df, x, {"datetime", "numeric"}, "X", "line")
        if y:
            _need(df, y, {"numeric"}, "Y", ct)
        levels = _color_levels(df, color)
        cols = list(dict.fromkeys([c for c in (x, y, color) if c]))
        sub = df[cols].copy()
        xkey = x
        if ct == "line" and kx == "datetime":
            interval = spec.get("interval") or "auto"
            if interval == "auto":
                span = (sub[x].max() - sub[x].min()).days if sub[x].notna().any() else 0
                interval = "day" if span <= 120 else "week" if span <= 730 else "month" if span <= 3650 else "year"
            if interval not in INTERVALS:
                raise ChartError("Interval must be day, week, month, quarter or year.")
            sub = sub.dropna(subset=[x])
            sub["__x"] = sub[x].dt.to_period({"day": "D", "week": "W", "month": "M", "quarter": "Q", "year": "Y"}[interval]).dt.start_time
            xkey = "__x"
            notes.append(f"Dates grouped by {interval}.")
        if ct == "bar" and spec.get("include_missing", True):
            if sub[x].isna().any():
                sub[x] = sub[x].astype(object).where(sub[x].notna(), MISSING_LABEL)
        else:
            sub = sub.dropna(subset=[xkey])
        if levels:
            sub = sub.dropna(subset=[color])
        if y:
            dropped = int(sub[y].isna().sum())
            if dropped and agg != "count":
                notes.append(f"{dropped:,} rows with missing {y} excluded from the {agg}.")
        keys = [xkey] + ([color] if levels else [])
        target = sub[y] if y else sub[xkey]
        g = target.groupby([sub[k] for k in keys], dropna=False)
        res = (g.count() if agg == "count" else getattr(g, agg)()).rename("value").reset_index()
        res.columns = (["x"] + (["group"] if levels else []) + ["value"])
        if ct == "bar":
            top_n = int(spec.get("top_n") or 20)
            if not 1 <= top_n <= 100:
                raise ChartError("Top N must be between 1 and 100.")
            order = res.groupby("x")["value"].sum().sort_values(ascending=False)
            if spec.get("sort") == "label":
                order = order.sort_index(key=lambda s: s.astype(str))
            shown = order.index[:top_n]
            if len(order) > top_n:
                notes.append(f"Showing the top {top_n} of {len(order):,} categories by {agg if y else 'count'}; the rest are not drawn (not pooled).")
            res = res[res["x"].isin(shown)]
            cat_order = [str(v) for v in shown]
        else:
            res = res.sort_values("x")
            cat_order = None
        traces = []
        groups = [(None, res)] if not levels else [(lv, res[res["group"] == lv]) for lv in levels]
        ylab = f"{agg} of {y}" if y else "Rows"
        for i, (lv, part) in enumerate(groups):
            xs = [str(v) for v in part["x"]] if ct == "bar" else clean(part["x"].tolist())
            t = {"type": "bar" if ct == "bar" else "scatter", "x": xs, "y": clean(part["value"].tolist()),
                 "name": str(lv) if lv is not None else ylab, "marker": {"color": PALETTE[i % 8]},
                 "hovertemplate": f"%{{x}}<br>{ylab}: %{{y:,.4~g}}<extra>%{{fullData.name}}</extra>"}
            if ct == "line":
                t["mode"] = "lines+markers"
                t["line"] = {"color": PALETTE[i % 8]}
            traces.append(t)
        extra: dict = {"barmode": "group"}
        if cat_order:
            extra["xaxis"] = {"title": {"text": x}, "categoryorder": "array", "categoryarray": cat_order, "type": "category"}
        fig = {"data": traces, "layout": _layout(f"{ylab} by {x}" + (f" and {color}" if levels else ""), x, ylab, **extra)}
        if extra.get("xaxis"):
            fig["layout"]["xaxis"] = extra["xaxis"]
        rows = clean(res.to_dict(orient="records"))
        used = int(len(sub))
        table_cols = ["x"] + (["group"] if levels else []) + ["value"]

    elif ct == "scatter":
        _need(df, x, {"numeric"}, "X", "scatter")
        _need(df, y, {"numeric"}, "Y", "scatter")
        levels = _color_levels(df, color)
        cols = list(dict.fromkeys([c for c in (x, y, color) if c]))
        sub = df[cols].dropna(subset=[x, y])
        used = len(sub)
        if used > SCATTER_MAX:
            sub = sub.sample(SCATTER_MAX, random_state=0)
            notes.append(f"Showing a random sample of {SCATTER_MAX:,} of {used:,} points (seed 0); the correlation below uses all {used:,}.")
        r = df[[x, y]].apply(pd.to_numeric, errors="coerce").dropna().corr().iloc[0, 1] if used >= 3 else None
        if r is not None and not pd.isna(r):
            notes.append(f"Pearson r = {r:.3f} over {used:,} rows with both values.")
        groups = [(None, sub)] if not levels else [(lv, sub[sub[color] == lv]) for lv in levels]
        traces = [{"type": "scatter", "mode": "markers", "x": clean(p[x].tolist()), "y": clean(p[y].tolist()),
                   "name": str(lv) if lv is not None else f"{y} vs {x}", "marker": {"color": PALETTE[i % 8], "size": 5, "opacity": 0.6},
                   "hovertemplate": f"{x}: %{{x}}<br>{y}: %{{y}}<extra>%{{fullData.name}}</extra>"} for i, (lv, p) in enumerate(groups)]
        fig = {"data": traces, "layout": _layout(f"{y} vs {x}", x, y)}
        rows = [{"x_column": x, "y_column": y, "rows_with_both": used, "pearson_r": clean(r)}]
        table_cols = ["x_column", "y_column", "rows_with_both", "pearson_r"]

    elif ct == "box":
        _need(df, y, {"numeric"}, "Y", "box")
        if x:
            kx = _kind(df, x)
            if kx not in ("categorical", "boolean"):
                raise ChartError(f'Box-plot groups need a categorical X; "{x}" is {kx}.')
            if df[x].nunique() > 20:
                raise ChartError(f'"{x}" has {df[x].nunique()} categories; box plots support at most 20 groups.')
        sub = df[[c for c in (x, y) if c]].dropna()
        used = len(sub)
        groups = [(y, sub[y])] if not x else [(str(k), v[y]) for k, v in sub.groupby(x)]
        traces, rows = [], []
        for i, (name, v) in enumerate(groups):
            v = pd.to_numeric(v, errors="coerce").dropna()
            if v.empty:
                continue
            q1, med, q3 = v.quantile([0.25, 0.5, 0.75])
            iqr = q3 - q1
            lo = v[v >= q1 - 1.5 * iqr].min()
            hi = v[v <= q3 + 1.5 * iqr].max()
            n_out = int(((v < q1 - 1.5 * iqr) | (v > q3 + 1.5 * iqr)).sum())
            traces.append({"type": "box", "name": name, "q1": [clean(q1)], "median": [clean(med)], "q3": [clean(q3)],
                           "lowerfence": [clean(lo)], "upperfence": [clean(hi)], "mean": [clean(v.mean())],
                           "marker": {"color": PALETTE[i % 8]}, "boxpoints": False, "x": [name]})
            rows.append({"group": name, "n": len(v), "min": v.min(), "q1": q1, "median": med, "q3": q3, "max": v.max(),
                         "mean": v.mean(), "outliers_1_5_iqr": n_out})
        notes.append("Whiskers at the most extreme values within 1.5×IQR; outlier counts are in the table (points not drawn).")
        fig = {"data": traces, "layout": _layout(f"{y}" + (f" by {x}" if x else ""), x or "", y, showlegend=False)}
        rows = clean(rows)
        table_cols = ["group", "n", "min", "q1", "median", "q3", "max", "mean", "outliers_1_5_iqr"]

    else:  # heatmap
        cols = spec.get("columns") or []
        bad = [c for c in cols if _kind(df, c) != "numeric"]
        if bad:
            raise ChartError(f"Correlation heatmaps need numeric columns; not numeric: {', '.join(bad)}.")
        if not 2 <= len(cols) <= 15:
            raise ChartError("Choose between 2 and 15 numeric columns.")
        corr = correlation(df, cols, spec.get("method") or "pearson")
        fig = {"data": [{"type": "heatmap", "x": cols, "y": cols, "z": corr["matrix"], "zmin": -1, "zmax": 1,
                         "colorscale": "RdBu", "customdata": corr["pairwise_n"],
                         "texttemplate": "%{z:.2f}", "hovertemplate": "%{y} × %{x}<br>r = %{z:.3f}<br>n = %{customdata:,}<extra></extra>"}],
               "layout": _layout(f"{corr['method'].title()} correlation", "", "", yaxis={"autorange": "reversed"})}
        rows = [{"row": a, **{b: corr["matrix"][i][j] for j, b in enumerate(cols)}} for i, a in enumerate(cols)]
        table_cols = ["row"] + cols
        used = n_total
        notes.append("Pairwise-complete observations; hover shows the n behind each coefficient. Correlation is not causation.")

    return {
        "kind": "chart",
        "title": fig["layout"]["title"]["text"],
        "spec": {k: v for k, v in spec.items() if v not in (None, "", [])},
        "figure": fig,
        "table": {"columns": table_cols, "rows": clean(rows)},
        "rows_total": n_total,
        "rows_used": int(used),
        "notes": notes,
    }
