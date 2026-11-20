"""Full-upload lookup regressions. Synthetic records only; no uploaded grades are committed."""
import asyncio
import json

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import chat
from app.main import app
from app.operations import OpError, filter_rows, run_operation
from app.profile import build_overview
from app.providers import ChatProviderError
from test_api import _fake, upload

client = TestClient(app)


@pytest.fixture
def records():
    df = pd.DataFrame({"Student Name": [f"Student {i}" for i in range(109)],
                       "Roll No": [f"00{i:03}" for i in range(109)],
                       "Total Marks": [float(109 - i) for i in range(109)]})
    df.loc[44, ["Student Name", "Total Marks"]] = ["TARGET STUDENT", 26]
    return df, build_overview(df)


def lookup(df, ov, **params):
    return run_operation("lookup_rows", df, ov, params)


def test_lookup_finds_record_outside_top20_and_handles_case_and_spaces(records):
    df, ov = records
    top = run_operation("group_aggregate", df, ov, {"group_by": "Student Name", "target": "Total Marks", "agg": "max"})
    assert top["evidence"]["output_truncated"]
    assert not any(r["group"] == "TARGET STUDENT" for r in top["table"]["rows"])
    r = lookup(df, ov, filters=[{"column": "Student Name", "op": "eq", "value": "  Target   Student "}], columns=["Total Marks"])
    assert r["evidence"] == {"rows_searched": 109, "rows_matched": 1, "search_complete": True,
                             "results_total": 1, "results_returned": 1, "output_truncated": False}
    assert r["table"]["rows"][0] == {"Student Name": "TARGET STUDENT", "Roll No": "00044", "Total Marks": 26}
    assert "Total Marks: 26" in chat.template_summary(r)


def test_duplicates_are_not_merged_and_identifier_disambiguates(records):
    df, _ = records
    df.loc[110] = ["Target Student", "00110", float("nan")]
    ov = build_overview(df)
    filters = [{"column": "Student Name", "op": "eq", "value": "target student"}]
    r = lookup(df, ov, filters=filters, columns=["Total Marks"])
    assert r["facts"]["matches"] == 2 and "Multiple records" in chat.template_summary(r)
    r = lookup(df, ov, filters=filters + [{"column": "Roll No", "op": "eq", "value": "00110"}], columns=["Total Marks"])
    assert r["table"]["rows"][0]["Total Marks"] is None
    assert "(missing)" in chat.template_summary(r)


def test_filter_before_sort_and_pagination_and_empty_page_is_not_not_found(records):
    df, ov = records
    r = lookup(df, ov, filters=[{"column": "Total Marks", "op": "lt", "value": 30}],
               sort_by="Total Marks", sort_desc=True, limit=2, offset=1, columns=["Total Marks"])
    expected = df.loc[df["Total Marks"] < 30].sort_values("Total Marks", ascending=False, kind="stable")
    assert r["facts"]["matches"] == len(expected)
    assert [x["Total Marks"] for x in r["table"]["rows"]] == expected["Total Marks"].iloc[1:3].tolist()
    assert r["evidence"]["output_truncated"]
    empty_page = lookup(df, ov, limit=10, offset=200, columns=["Student Name"])
    assert empty_page["facts"]["matches"] == 109
    assert "No records match" not in chat.template_summary(empty_page)
    miss = lookup(df, ov, filters=[{"column": "Student Name", "op": "eq", "value": "Unknown Student"}])
    assert miss["facts"]["matches"] == 0 and "all 109" in chat.template_summary(miss)


def test_filters_apply_to_aggregations_and_recompute_subset_overview(records):
    df, ov = records
    filters = [{"column": "Roll No", "op": "in", "value": ["00044", "00045"]}]
    r = run_operation("describe_column", df, ov, {"column": "Total Marks", "filters": filters})
    assert r["facts"]["rows"] == 2 and r["facts"]["mean"] == 45
    r = run_operation("overview", df, ov, {"filters": filters})
    assert r["facts"]["rows"] == 2 and r["evidence"]["rows_searched"] == 109


def test_literal_search_or_filters_missing_and_date_values():
    df = pd.DataFrame({"name": ["a.*b", "aZZb", None], "score": [0, 2, None],
                       "date": pd.to_datetime(["2026-01-01", "2026-02-01", None]), "flag": [True, False, True]})
    assert filter_rows(df, [{"column": "name", "op": "contains", "value": ".*"}]).index.tolist() == [0]
    assert filter_rows(df, [{"column": "score", "op": "eq", "value": 0}]).index.tolist() == [0]
    assert filter_rows(df, [{"column": "name", "op": "ne", "value": "a.*b"}]).index.tolist() == [1]
    assert filter_rows(df, [{"column": "date", "op": "gte", "value": "2026-02-01"}]).index.tolist() == [1]
    assert filter_rows(df, [{"column": "score", "op": "is_null"}, {"column": "flag", "op": "eq", "value": "false"}], "any").index.tolist() == [1, 2]


def test_integer_identifiers_are_not_rounded_by_filters():
    df = pd.DataFrame({"id": [9007199254740992, 9007199254740993]})
    assert filter_rows(df, [{"column": "id", "op": "eq", "value": "9007199254740993"}]).index.tolist() == [1]


def test_lookup_searches_last_row_at_upload_row_limit():
    df = pd.DataFrame({"name": ["Other"] * 199_999 + ["Last Record"], "score": [0] * 199_999 + [26]})
    r = lookup(df, {"column_info": []}, filters=[{"column": "name", "op": "eq", "value": "last record"}], columns=["score"])
    assert r["evidence"]["rows_searched"] == 200_000 and r["table"]["rows"] == [{"name": "Last Record", "score": 26}]


@pytest.mark.parametrize("params", [
    {"filters": {"column": "Student Name"}}, {"filters": [{"column": "secret", "op": "eq", "value": "x"}]},
    {"filters": [{"column": "Total Marks", "op": "gt", "value": "NaN"}]},
    {"filters": [{"column": "Student Name", "op": "regex", "value": ".*"}]},
    {"filters": [{"column": "Total Marks", "op": "in", "value": "26"}]},
    {"filters": [{"column": "Total Marks", "op": "eq", "value": None}]},
    {"filters": [{"column": "Student Name", "op": "contains", "value": ""}]},
    {"filters": [{"column": "Student Name", "op": "eq", "value": "x"}] * 11},
    {"limit": 0}, {"limit": 101}, {"offset": -1}, {"sort_desc": "false"}, {"columns": []},
    {"filter": {"name": "target"}}, {"code": "import os"},
])
def test_invalid_query_is_rejected_not_silently_ignored(records, params):
    with pytest.raises(OpError):
        lookup(*records, **params)


def test_rows_search_needs_no_ai_and_paginates_over_matches(records):
    df, _ = records
    sid = upload("synthetic.csv", df.to_csv(index=False).encode()).json()["session_id"]
    base = f"/api/sessions/{sid}/rows/search"
    r = client.post(base, json={"column": "Student Name", "value": "target student", "match": "eq"})
    assert r.status_code == 200, r.text
    assert r.json()["total"] == 1 and r.json()["rows_searched"] == 109
    assert r.json()["rows"][0]["Total Marks"] == 26
    r = client.post(base, params={"offset": 100, "limit": 5}, json={"column": "Student Name", "value": "student", "match": "contains"})
    assert r.json()["total"] == 109 and len(r.json()["rows"]) == 5
    assert client.post(base, json={"column": "missing", "value": "x"}).status_code == 422
    assert client.post(base, json={"column": "Student Name"}).status_code == 422


def test_chat_lookup_uses_one_model_call_and_exports_exact_answer(monkeypatch, records):
    df, _ = records
    sid = upload("synthetic.csv", df.to_csv(index=False).encode()).json()["session_id"]
    plan = {"type": "plan", "operation": "lookup_rows", "params": {
        "filters": [{"column": "Student Name", "op": "eq", "value": "target student"}], "columns": ["Total Marks"]}}
    fake = _fake(monkeypatch, [json.dumps(plan)])  # no explanation call is allowed/needed
    b = client.post(f"/api/sessions/{sid}/chat", json={"question": "What are Target Student's total marks?"}).json()
    assert b["type"] == "answer" and b["explanation_source"] == "template"
    assert "Total Marks: 26" in b["explanation"] and len(fake.messages.calls) == 1
    assert "lookup_rows" in fake.messages.calls[0]["system"]
    html = client.get(f"/api/sessions/{sid}/export/report.html").text
    assert "TARGET STUDENT" in html and "Total Marks: 26" in html


def test_partial_aggregation_never_gets_an_ai_absence_explanation(monkeypatch, records):
    df, _ = records
    sid = upload("synthetic.csv", df.to_csv(index=False).encode()).json()["session_id"]
    fake = _fake(monkeypatch, [json.dumps({"type": "plan", "operation": "group_aggregate", "params": {
        "group_by": "Student Name", "target": "Total Marks", "agg": "max"}})])
    b = client.post(f"/api/sessions/{sid}/chat", json={"question": "List the highest marks"}).json()
    assert b["explanation_source"] == "template" and len(fake.messages.calls) == 1
    assert "partial table" in b["explanation"]


def test_explanation_failure_keeps_computed_result_and_bad_plan_fails_cleanly(monkeypatch, records):
    df, ov = records

    class FakeLlm:
        provider = type("P", (), {"name": "gemini"})()
        model = "fake"

        async def complete(self, *args):
            if len(args) > 1 and "<dataset>" in args[1]:
                return json.dumps({"type": "plan", "operation": "describe_column", "params": {"column": "Total Marks"}})
            raise ChatProviderError("rate_limit", "Quota exceeded")

    async def fake(*args):
        return FakeLlm()
    monkeypatch.setattr(chat, "_llm", fake)
    b = asyncio.run(chat.answer("Describe marks", "synthetic.csv", df, ov, [], None))
    assert b["type"] == "answer" and b["explanation_source"] == "template" and b["result"]["facts"]["rows"] == 109
    sid = upload().json()["session_id"]
    monkeypatch.undo()
    _fake(monkeypatch, ["[]"])
    assert client.post(f"/api/sessions/{sid}/chat", json={"question": "Describe marks"}).json()["type"] == "error"
