"""End-to-end tests of the EDAgent API: upload → overview → charts → chat (fake model) → exports.

Run: api/.venv/Scripts/python -m pytest api/tests -q
"""

from __future__ import annotations

import io
import json
import zipfile
from types import SimpleNamespace

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import chat as chat_mod
from app.main import app
from app.sessions import store

client = TestClient(app)

CSV = (
    "region,product,units,price,date,id\n"
    + "\n".join(
        f"{['North','South','East','West'][i % 4]},{['A','B','C'][i % 3]},{(i * 7) % 50 + 1},{10 + (i % 5) * 2.5},2024-{(i % 12) + 1:02d}-15,{1000 + i}"
        for i in range(120)
    )
    + "\nNorth,A,,12.5,2024-01-15,2000\n"
)


def upload(name="sales.csv", data=CSV.encode()):
    r = client.post("/api/sessions", files={"file": (name, data, "text/csv")})
    return r


def test_health_reports_limits_and_ai_status():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["limits"]["max_upload_mb"] == 10
    assert ".csv" in body["limits"]["supported_extensions"]
    assert "api_key" not in json.dumps(body).lower()


def test_csv_upload_overview_and_quality():
    r = upload()
    assert r.status_code == 200, r.text
    b = r.json()
    ov = b["overview"]
    assert ov["rows"] == 121 and ov["columns"] == 6
    kinds = {c["name"]: c["kind"] for c in ov["column_info"]}
    assert kinds["units"] == "numeric" and kinds["region"] == "categorical"
    assert kinds["date"] == "datetime" and kinds["id"] == "identifier"
    units = next(c for c in ov["column_info"] if c["name"] == "units")
    assert units["missing"] == 1
    df = pd.read_csv(io.StringIO(CSV))
    assert units["stats"]["mean"] == pytest.approx(df["units"].mean())
    assert any(w["kind"] == "identifier" for w in ov["warnings"])


@pytest.mark.parametrize(
    "name,data",
    [
        ("d.json", json.dumps([{"a": 1, "b": "x"}, {"a": 2, "b": "y"}]).encode()),
        ("d.json", json.dumps({"data": [{"a": 1}, {"a": 3}]}).encode()),
        ("d.json", json.dumps({"a": [1, 2, 3], "b": ["x", "y", "z"]}).encode()),
        ("d.jsonl", b'{"a": 1}\n{"a": 2}\n'),
        ("d.tsv", b"a\tb\n1\tx\n2\ty\n"),
    ],
)
def test_other_formats(name, data):
    r = upload(name, data)
    assert r.status_code == 200, r.text
    assert r.json()["overview"]["rows"] >= 2


def test_xlsx_upload():
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as w:
        pd.DataFrame({"x": [1, 2, 3], "g": ["a", "b", "a"]}).to_excel(w, index=False, sheet_name="Data")
        pd.DataFrame({"y": [1]}).to_excel(w, index=False, sheet_name="Other")
    r = upload("book.xlsx", buf.getvalue())
    assert r.status_code == 200, r.text
    assert r.json()["details"]["sheets"] == ["Data", "Other"]


@pytest.mark.parametrize(
    "name,data,msg",
    [
        ("x.parquet", b"PAR1", "Unsupported file type"),
        ("x.csv", b"", "empty"),
        ("x.json", b"{not json", "Invalid JSON"),
        ("x.json", b'"just a string"', "Unsupported JSON layout"),
        ("x.xlsx", b"not a zip", "not a valid .xlsx"),
    ],
)
def test_invalid_uploads(name, data, msg):
    r = upload(name, data)
    assert r.status_code == 422
    assert msg.lower() in r.json()["error"]["message"].lower()


def test_too_large(monkeypatch):
    big = b"a\n" + b"1\n" * (6 * 1024 * 1024)
    r = upload("big.csv", big)
    assert r.status_code == 422 and "limit" in r.json()["error"]["message"]


def test_charts_valid_and_invalid():
    sid = upload().json()["session_id"]
    ok = client.post(f"/api/sessions/{sid}/charts", json={"chart_type": "bar", "x": "region", "y": "units", "agg": "sum"})
    assert ok.status_code == 200, ok.text
    res = ok.json()
    df = pd.read_csv(io.StringIO(CSV))
    expected = df.groupby("region")["units"].sum()
    got = {r["x"]: r["value"] for r in res["table"]["rows"]}
    assert got["North"] == pytest.approx(expected["North"])
    for spec in [
        {"chart_type": "histogram", "x": "units", "bins": 10},
        {"chart_type": "histogram", "x": "units", "color": "product"},
        {"chart_type": "line", "x": "date", "y": "units", "agg": "mean", "interval": "month"},
        {"chart_type": "scatter", "x": "units", "y": "price", "color": "region"},
        {"chart_type": "box", "y": "price", "x": "region"},
        {"chart_type": "heatmap", "columns": ["units", "price"]},
        {"chart_type": "bar", "x": "product"},
    ]:
        r = client.post(f"/api/sessions/{sid}/charts", json=spec)
        assert r.status_code == 200, (spec, r.text)
    hist = client.post(f"/api/sessions/{sid}/charts", json={"chart_type": "histogram", "x": "units", "bins": 10}).json()
    assert sum(r["count"] for r in hist["table"]["rows"]) == 120  # one missing value excluded
    for spec, frag in [
        ({"chart_type": "histogram", "x": "region"}, "must be numeric"),
        ({"chart_type": "scatter", "x": "units", "y": "region"}, "must be numeric"),
        ({"chart_type": "bar", "x": "units"}, "histogram"),
        ({"chart_type": "bar", "x": "region", "agg": "mean"}, "needs a numeric Y"),
        ({"chart_type": "bar", "x": "nope"}, "does not exist"),
        ({"chart_type": "pie", "x": "region"}, "Unknown chart type"),
        ({"chart_type": "bar", "x": "region", "color": "units"}, "categorical"),
    ]:
        r = client.post(f"/api/sessions/{sid}/charts", json=spec)
        assert r.status_code == 422 and frag in r.json()["error"]["message"], (spec, r.text)


def test_chat_disabled_without_configuration(monkeypatch):
    sid = upload().json()["session_id"]
    r = client.post(f"/api/sessions/{sid}/chat", json={"question": "What is the average units?"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "ai_unavailable"


class FakeMessages:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    async def create(self, **kw):
        self.calls.append(kw)
        text = self.replies.pop(0)
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=text)])


class FakeClient:
    def __init__(self, replies):
        self.messages = FakeMessages(replies)
        self.beta = SimpleNamespace(messages=self.messages)


def _fake(monkeypatch, replies):
    fake = FakeClient(replies)
    monkeypatch.setattr(chat_mod, "_client", lambda key: fake)
    return fake


def test_chat_answer_is_grounded(monkeypatch):
    sid = upload().json()["session_id"]
    df = pd.read_csv(io.StringIO(CSV))
    north = df[df.region == "North"]["units"].sum()
    fake = _fake(monkeypatch, [
        json.dumps({"type": "plan", "operation": "group_aggregate", "params": {"group_by": "region", "target": "units", "agg": "sum"}}),
        f"North has the highest total units at {int(north)}.",
    ])
    r = client.post(f"/api/sessions/{sid}/chat", json={"question": "Which region sold the most units?"})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["type"] == "answer" and b["explanation_source"] == "ai"
    assert {row["group"]: row["value"] for row in b["result"]["table"]["rows"]}["North"] == pytest.approx(north)
    # Dataset context is sent as data; no code execution in the plan.
    assert "<dataset>" in fake.messages.calls[0]["messages"][0]["content"]


def test_chat_ungrounded_numbers_are_withheld(monkeypatch):
    sid = upload().json()["session_id"]
    _fake(monkeypatch, [
        json.dumps({"type": "plan", "operation": "describe_column", "params": {"column": "price"}}),
        "The average price is 99999.5, which is very high.",
    ])
    b = client.post(f"/api/sessions/{sid}/chat", json={"question": "Describe price"}).json()
    assert b["explanation_source"] == "template" and "99999.5" in b["withheld_numbers"]


def test_chat_decline_and_clarify_and_bad_column(monkeypatch):
    sid = upload().json()["session_id"]
    _fake(monkeypatch, [json.dumps({"type": "decline", "message": "This question is unrelated to the uploaded dataset."})])
    b = client.post(f"/api/sessions/{sid}/chat", json={"question": "Write me a poem"}).json()
    assert b["type"] == "decline"
    _fake(monkeypatch, [json.dumps({"type": "clarify", "message": "Which measure?", "options": ["units", "price"]})])
    b = client.post(f"/api/sessions/{sid}/chat", json={"question": "Compare sales"}).json()
    assert b["type"] == "clarify" and b["options"] == ["units", "price"]
    _fake(monkeypatch, [json.dumps({"type": "plan", "operation": "describe_column", "params": {"column": "revenue"}})])
    b = client.post(f"/api/sessions/{sid}/chat", json={"question": "Describe revenue"}).json()
    assert b["type"] == "decline" and "does not exist" in b["message"]
    _fake(monkeypatch, [json.dumps({"type": "plan", "operation": "exec_python", "params": {"code": "import os"}})])
    b = client.post(f"/api/sessions/{sid}/chat", json={"question": "run code"}).json()
    assert b["type"] == "decline" and "not an approved operation" in b["message"]


def test_byok_rejected_when_disabled():
    sid = upload().json()["session_id"]
    r = client.post(f"/api/sessions/{sid}/chat", json={"question": "x"}, headers={"X-LLM-Api-Key": "sk-ant-test"})
    assert r.status_code == 503 and "does not accept" in r.json()["error"]["message"]


def test_exports_and_expiry(monkeypatch):
    sid = upload().json()["session_id"]
    client.post(f"/api/sessions/{sid}/charts", json={"chart_type": "bar", "x": "region"})
    rep = client.get(f"/api/sessions/{sid}/export/report.html")
    assert rep.status_code == 200 and "EDAgent analysis report" in rep.text and "Count" not in rep.headers.get("content-type", "")
    assert "Rows by region" in rep.text
    js = client.get(f"/api/sessions/{sid}/export/results.json").json()
    assert len(js["results"]) == 1
    z = zipfile.ZipFile(io.BytesIO(client.get(f"/api/sessions/{sid}/export/bundle.zip").content))
    assert "report.html" in z.namelist() and any(n.startswith("tables/") for n in z.namelist())
    # Expiry
    s = store.get(sid)
    s.last_access -= 10 * 3600
    r = client.get(f"/api/sessions/{sid}")
    assert r.status_code == 404 and r.json()["error"]["code"] == "session_not_found"


def test_delete_session():
    sid = upload().json()["session_id"]
    assert client.delete(f"/api/sessions/{sid}").status_code == 200
    assert client.get(f"/api/sessions/{sid}").status_code == 404


def test_formula_injection_guard():
    data = b"name,val\n=HYPERLINK(1),1\nok,2\n"
    sid = upload("f.csv", data).json()["session_id"]
    client.post(f"/api/sessions/{sid}/charts", json={"chart_type": "bar", "x": "name"})
    z = zipfile.ZipFile(io.BytesIO(client.get(f"/api/sessions/{sid}/export/bundle.zip").content))
    table = next(n for n in z.namelist() if n.startswith("tables/"))
    assert "'=HYPERLINK" in z.read(table).decode()


def test_rate_limiter_and_validation_shape():
    from app.util import RateLimiter
    rl = RateLimiter()
    assert all(rl.allow("k", 3) for _ in range(3)) and not rl.allow("k", 3)
    sid = upload().json()["session_id"]
    r = client.post(f"/api/sessions/{sid}/chat", json={"question": ""})
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_request"


def test_memory_budget_evicts_and_rejects(monkeypatch):
    from app import sessions as sess_mod
    from app.config import Settings
    monkeypatch.setattr(sess_mod, "settings", Settings(session_memory_budget_mb=1, max_sessions=100))
    store._s.clear()
    big = pd.DataFrame({"x": range(80_000)})  # ~0.64 MB; two exceed 1 MB
    a = store.create(filename="a", file_format="CSV", df=big, overview={}, details={}, notes=[])
    store.create(filename="b", file_format="CSV", df=big.copy(), overview={}, details={}, notes=[])
    assert store.get(a.id) is None  # oldest evicted to stay within budget
    with pytest.raises(MemoryError):
        store.create(filename="c", file_format="CSV", df=pd.DataFrame({"x": range(300_000)}), overview={}, details={}, notes=[])


# ---------------- regression tests for the QA findings (2026-11-20) ----------------

def test_html_report_escapes_chart_json_and_zip_copy():
    data = b"label,val\n<script>alert(1)</script>,1\n</script><img src=x onerror=alert(2)>,2\nok,3\n"
    sid = upload("inj.csv", data).json()["session_id"]
    assert client.post(f"/api/sessions/{sid}/charts", json={"chart_type": "bar", "x": "label"}).status_code == 200
    html = client.get(f"/api/sessions/{sid}/export/report.html").text
    zipped = zipfile.ZipFile(io.BytesIO(client.get(f"/api/sessions/{sid}/export/bundle.zip").content)).read("report.html").decode()
    for doc in (html, zipped):
        assert "<script>alert(1)" not in doc and "<img src=x" not in doc
        # Exactly the expected script elements: Plotly CDN, one per figure, the renderer.
        assert doc.count("<script") == 3
        assert r"\u003cscript\u003ealert(1)" in doc  # escaped JSON text, decoded by the JS parser


def test_leading_zeros_preserved_and_noted():
    b = upload("z.csv", b"zip,phone,amount\n01234,0123456789,10\n00501,0987654321,20\n15213,4125551234,30\n").json()
    kinds = {c["name"]: c for c in b["overview"]["column_info"]}
    assert kinds["zip"]["kind"] != "numeric" and kinds["zip"]["sample"][:2] == ["01234", "00501"]
    assert kinds["amount"]["kind"] == "numeric"
    assert any("leading zeros" in n and "zip" in n for n in b["notes"])
    rows = client.get(f"/api/sessions/{b['session_id']}/rows").json()["rows"]
    assert rows[0]["zip"] == "01234"


def test_partially_numeric_text_is_not_silently_coerced():
    body = "code\n" + "\n".join(str(i) for i in range(60)) + "\nN/A-7\n"
    b = upload("p.csv", body.encode()).json()
    col = b["overview"]["column_info"][0]
    assert col["missing"] == 0 and col["kind"] != "numeric"


def test_identifier_detection_vs_measurements():
    rows = ["record_id,score,count,group_code,uid"]
    for i in range(22):
        rid = 1000 + (i if i < 20 else i - 20)  # 20 unique of 22 (duplicates present)
        rows.append(f"{rid},{(i % 20) + 1}.0,{i % 5},{(i % 3) + 1},u{i:03d}")
    kinds = {c["name"]: c["kind"] for c in upload("ids.csv", "\n".join(rows).encode()).json()["overview"]["column_info"]}
    assert kinds["record_id"] == "identifier"
    assert kinds["uid"] == "identifier"
    assert kinds["score"] == "numeric" and kinds["count"] == "numeric"
    assert kinds["group_code"] == "categorical"


def test_bins_and_top_n_zero_rejected_and_heatmap_default_columns():
    sid = upload().json()["session_id"]
    assert client.post(f"/api/sessions/{sid}/charts", json={"chart_type": "histogram", "x": "units", "bins": 0}).status_code == 422
    assert client.post(f"/api/sessions/{sid}/charts", json={"chart_type": "bar", "x": "region", "top_n": 0}).status_code == 422
    r = client.post(f"/api/sessions/{sid}/charts", json={"chart_type": "heatmap"})
    assert r.status_code == 200 and set(r.json()["figure"]["data"][0]["x"]) >= {"units", "price"}
