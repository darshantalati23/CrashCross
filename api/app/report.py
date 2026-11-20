"""Exports generated from a session's actual results: HTML report, JSON, CSV bundle (ZIP)."""

from __future__ import annotations

import csv
import html
import io
import json
import zipfile
from datetime import datetime, timezone

from .sessions import Session
from .util import clean

PLOTLY_CDN = "https://cdn.plot.ly/plotly-2.35.2.min.js"


def json_for_script(obj) -> str:
    """JSON that is safe inside an HTML <script> element: no '</script>', '<!--', '&' or line separators."""
    out = json.dumps(obj, default=str)
    return "".join(_SCRIPT_ESCAPES.get(ch, ch) for ch in out)


# Characters replaced by their JSON unicode escapes (backslash + u + 4 hex digits); JSON.parse and
# JavaScript object literals decode them back to the original text.
_SCRIPT_ESCAPES = {ch: chr(92) + f"u{ord(ch):04x}" for ch in ("<", ">", "&", chr(0x2028), chr(0x2029))}


def _esc(v) -> str:
    return html.escape("" if v is None else str(v))


def _fmt(v) -> str:
    if isinstance(v, float):
        return f"{v:,.4g}" if abs(v) < 1e6 else f"{v:,.0f}"
    if isinstance(v, int) and not isinstance(v, bool):
        return f"{v:,}"
    return _esc(v)


def _table(columns: list[str], rows: list[dict], limit: int = 50) -> str:
    head = "".join(f"<th>{_esc(c)}</th>" for c in columns)
    body = "".join("<tr>" + "".join(f"<td>{_fmt(r.get(c))}</td>" for c in columns) + "</tr>" for r in rows[:limit])
    more = f"<p class='muted'>Showing {limit} of {len(rows)} rows; the full table is in the CSV bundle.</p>" if len(rows) > limit else ""
    return f"<div class='tw'><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>{more}"


def html_report(s: Session) -> str:
    ov = s.overview
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    parts: list[str] = []
    parts.append(f"<h1>EDAgent analysis report</h1><p class='muted'>Dataset <b>{_esc(s.filename)}</b> ({_esc(s.file_format)}) · generated {now}. "
                 "All numbers were computed by the EDAgent backend from the uploaded file. Text marked “AI explanation” was written by a "
                 "language model and checked against the computed numbers.</p>")
    parts.append("<h2>1. Dataset overview</h2>")
    parts.append(_table(["measure", "value"], [
        {"measure": "Rows", "value": ov["rows"]}, {"measure": "Columns", "value": ov["columns"]},
        {"measure": "Exact duplicate rows", "value": ov["duplicate_rows"]}, {"measure": "Rows with no missing values", "value": ov["complete_rows"]},
        {"measure": "Missing cells", "value": ov["missing_cells"]}]))
    if s.notes:
        parts.append("<ul>" + "".join(f"<li>{_esc(n)}</li>" for n in s.notes) + "</ul>")
    parts.append("<h2>2. Columns</h2>")
    parts.append(_table(["name", "kind", "dtype", "missing", "missing_percent", "unique"], ov["column_info"], 500))
    parts.append("<h2>3. Quality checks</h2>")
    if ov["warnings"]:
        parts.append("<ul>" + "".join(f"<li><b>{_esc(w['column'] or 'Dataset')}</b> — {_esc(w['message'])}</li>" for w in ov["warnings"]) + "</ul>")
    else:
        parts.append("<p>No quality warnings were raised by the automatic checks.</p>")
    parts.append("<h2>4. Results</h2>")
    if not s.results:
        parts.append("<p class='muted'>No charts or chat answers were created in this session.</p>")
    for i, r in enumerate(s.results, 1):
        res = r.get("result", r)
        title = res.get("title") or r.get("question") or "Result"
        parts.append(f"<section class='res'><h3>4.{i} {_esc(title)}</h3>")
        if r.get("question"):
            parts.append(f"<p><b>Question:</b> {_esc(r['question'])}</p>")
        if r.get("explanation"):
            label = "AI explanation (numbers verified against the result)" if r.get("explanation_source") == "ai" else "Summary (generated from computed values)"
            parts.append(f"<p class='expl'><span class='tag'>{label}</span> {_esc(r['explanation'])}</p>")
        if res.get("figure"):
            parts.append(f"<div class='fig' id='fig{i}'></div><script>window.__figs=window.__figs||[];window.__figs.push(['fig{i}',{json_for_script(res['figure'])}]);</script>")
        for n in res.get("notes") or []:
            parts.append(f"<p class='muted'>{_esc(n)}</p>")
        if res.get("facts"):
            parts.append(_table(["measure", "value"], [{"measure": k, "value": v} for k, v in res["facts"].items()]))
        if res.get("table"):
            parts.append(_table(res["table"]["columns"], res["table"]["rows"]))
        parts.append("</section>")
    style = """body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;color:#1c2430;line-height:1.5}
h1{font-family:Georgia,serif}h2{border-bottom:1px solid #ddd;padding-bottom:.25rem;margin-top:2rem}.muted{color:#6b7280;font-size:.9rem}
table{border-collapse:collapse;font-size:.85rem;margin:.5rem 0}th,td{border:1px solid #e5e7eb;padding:.25rem .5rem;text-align:left}th{background:#f3f4f6}
.tw{overflow-x:auto}.res{border:1px solid #e5e7eb;border-radius:8px;padding:.5rem 1rem;margin:1rem 0}.fig{height:380px}
.tag{display:inline-block;background:#e7f0f7;color:#164766;border-radius:4px;padding:0 .4rem;font-size:.75rem;margin-right:.25rem}
@media print{.fig{page-break-inside:avoid}}"""
    script = (f"<script src='{PLOTLY_CDN}'></script><script>(window.__figs||[]).forEach(function(f){{"
              "if(window.Plotly){Plotly.newPlot(f[0],f[1].data,f[1].layout,{displaylogo:false,responsive:true});}"
              "else{document.getElementById(f[0]).innerHTML='<p class=muted>Interactive chart needs an internet connection (Plotly CDN); the table below has the values.</p>';}});</script>")
    return (f"<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<title>EDAgent report — {_esc(s.filename)}</title><style>{style}</style></head><body>{''.join(parts)}{script}</body></html>")


def results_json(s: Session) -> str:
    return json.dumps(clean({"filename": s.filename, "format": s.file_format, "overview": s.overview, "notes": s.notes,
                             "results": s.results, "exported": datetime.now(timezone.utc).isoformat()}), indent=2, default=str)


def _csv(columns: list[str], rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(columns)
    for r in rows:
        vals = []
        for c in columns:
            v = r.get(c)
            v = "" if v is None else str(v)
            if v[:1] in ("=", "+", "-", "@") and not _is_number(v):
                v = "'" + v  # spreadsheet formula-injection guard
            vals.append(v)
        w.writerow(vals)
    return buf.getvalue()


def _is_number(v: str) -> bool:
    try:
        float(v)
        return True
    except ValueError:
        return False


def bundle_zip(s: Session) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("report.html", html_report(s))
        z.writestr("results.json", results_json(s))
        z.writestr("columns.csv", _csv(["name", "kind", "dtype", "missing", "missing_percent", "unique"], s.overview["column_info"]))
        for i, r in enumerate(s.results, 1):
            res = r.get("result", r)
            if res.get("table"):
                z.writestr(f"tables/{i:02d}_{(res.get('operation') or res.get('kind') or 'result')}.csv",
                           _csv(res["table"]["columns"], res["table"]["rows"]))
    return buf.getvalue()
