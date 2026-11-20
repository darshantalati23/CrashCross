"""Gemini and Grok providers, key handling, model validation and Auto selection (HTTP mocked; no network)."""

from __future__ import annotations

import asyncio
import io
import json

import httpx
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import chat as chat_mod
from app import providers
from app.main import app
from app.sessions import store  # noqa: F401
from test_api import CSV, upload

client = TestClient(app)
GKEY, XKEY = "AIzaSECRETgeminikey", "xai-SECRETgrokkey"


def test_gemini_preset_check_skips_discovery(monkeypatch):
    def handler(req):
        assert req.method == "POST"  # a slow/unavailable model listing cannot block presets
        assert req.url.path.endswith("/gemini-3.1-flash-lite:generateContent")
        return httpx.Response(200, json=gemini_ok())
    calls = mock(monkeypatch, handler)
    r = client.post("/api/models", headers=hdr("gemini", GKEY, "gemini-3.1-flash-lite"))
    assert r.status_code == 200, r.text
    assert r.json()["model"] == "gemini-3.1-flash-lite" and len(calls) == 1


def test_gemini_default_and_auto_prefer_requested_model(monkeypatch):
    async def no_listing(key):
        pytest.fail("The default chat model must not require discovery")
    monkeypatch.setattr(providers.PROVIDERS["gemini"], "list_models", no_listing)
    object.__setattr__(providers.settings, "allow_byok", True)
    llm = asyncio.run(chat_mod._llm("gemini", GKEY, None))
    assert llm.model == "gemini-3.1-flash-lite"
    assert providers.PROVIDERS["gemini"].rank(["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"])[0] == llm.model


def test_model_check_has_total_deadline(monkeypatch):
    async def stalled(key):
        await asyncio.Event().wait()
    monkeypatch.setattr(providers.PROVIDERS["gemini"], "list_models", stalled)
    monkeypatch.setattr(providers, "MODEL_CHECK_TIMEOUT_SECONDS", 0.01)
    mock(monkeypatch, lambda req: pytest.fail("No network expected"))
    r = client.post("/api/models", headers=hdr("gemini", GKEY))
    assert r.status_code == 502 and r.json()["error"]["code"] == "ai_timeout"


def gemini_models(*names):
    return {"models": [{"name": f"models/{n}", "supportedGenerationMethods": ["generateContent"]} for n in names]}


@pytest.fixture(autouse=True)
def _restore_settings():
    old = providers.settings.allow_byok
    yield
    object.__setattr__(providers.settings, "allow_byok", old)


def mock(monkeypatch, handler):
    calls = []

    def h(req: httpx.Request):
        calls.append(req)
        return handler(req)
    monkeypatch.setattr(providers, "_transport", httpx.MockTransport(h))
    object.__setattr__(providers.settings, "allow_byok", True)
    return calls


def gemini_ok(text="OK"):
    return {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}]}


def grok_ok(text="OK"):
    return {"choices": [{"message": {"role": "assistant", "content": text}, "finish_reason": "stop"}]}


def hdr(provider, key, model=None):
    h = {"X-LLM-Provider": provider, "X-LLM-Api-Key": key}
    if model:
        h["X-LLM-Model"] = model
    return h


def test_gemini_auto_skips_unusable_models_and_validates(monkeypatch):
    def handler(req):
        assert req.headers["x-goog-api-key"] == GKEY and GKEY not in str(req.url)
        if req.method == "GET":
            return httpx.Response(200, json=gemini_models("gemini-2.5-pro", "gemini-2.5-flash", "text-embedding-004", "gemini-3-flash-preview"))
        if "gemini-2.5-flash" in req.url.path:
            return httpx.Response(404, json={"error": {"message": "not found"}})
        return httpx.Response(200, json=gemini_ok())
    calls = mock(monkeypatch, handler)
    r = client.post("/api/models", headers=hdr("gemini", GKEY))
    b = r.json()
    assert r.status_code == 200, r.text
    # Stable flash ranks first but is unavailable; Auto reports it and falls through to the next working model.
    assert b["model"] == "gemini-2.5-pro" and b["auto"] and b["failures"][0]["model"] == "gemini-2.5-flash"
    assert "text-embedding-004" not in providers.PROVIDERS["gemini"].rank(b["models"])
    assert all(c.url.host == "generativelanguage.googleapis.com" for c in calls)
    assert GKEY not in r.text


def test_grok_explicit_model_validated_and_unavailable(monkeypatch):
    def handler(req):
        assert req.headers["authorization"] == f"Bearer {XKEY}" and req.url.host == "api.x.ai"
        if req.method == "GET":
            return httpx.Response(200, json={"data": [{"id": "grok-4.7"}, {"id": "grok-4.3"}, {"id": "grok-imagine-image"}]})
        body = json.loads(req.content)
        assert body["max_completion_tokens"] >= 16
        if body["model"] != "grok-4.3":
            return httpx.Response(404, json={"error": "model not found"})
        return httpx.Response(200, json=grok_ok())
    mock(monkeypatch, handler)
    b = client.post("/api/models", headers=hdr("grok", XKEY, "grok-4.3")).json()
    assert b["model"] == "grok-4.3" and b["auto"] is False
    r = client.post("/api/models", headers=hdr("grok", XKEY, "grok-9"))
    assert r.status_code == 502 and r.json()["error"]["code"] == "ai_model_unavailable"
    auto = client.post("/api/models", headers=hdr("grok", XKEY, "auto")).json()
    assert auto["auto"] and auto["model"] == "grok-4.3"  # grok-4.3 is the only model the mock lets pass validation


@pytest.mark.parametrize("provider,key,resp", [
    ("gemini", GKEY, httpx.Response(400, json={"error": {"message": f"API key not valid. Please pass a valid API key. {GKEY}"}})),
    ("gemini", GKEY, httpx.Response(403, json={"error": {"message": "denied"}})),
    ("grok", XKEY, httpx.Response(401, json={"error": "Incorrect API key provided"})),
])
def test_invalid_keys_are_reported_without_echoing_the_key(monkeypatch, provider, key, resp):
    mock(monkeypatch, lambda req: resp)
    r = client.post("/api/models", headers=hdr(provider, key))
    assert r.status_code == 502 and r.json()["error"]["code"] == "ai_auth"
    assert key not in r.text


def test_auto_reports_all_failures(monkeypatch):
    def handler(req):
        if req.method == "GET":
            return httpx.Response(200, json=gemini_models("gemini-2.5-flash", "gemini-2.5-pro"))
        return httpx.Response(429, json={"error": {"message": "quota"}})
    mock(monkeypatch, handler)
    r = client.post("/api/models", headers=hdr("gemini", GKEY))
    m = r.json()["error"]["message"]
    assert r.status_code == 502 and "Auto could not find a working" in m and "gemini-2.5-flash" in m and "gemini-2.5-pro" in m


def test_no_provider_guessing_and_byok_gating(monkeypatch):
    calls = mock(monkeypatch, lambda req: httpx.Response(200, json=gemini_models("gemini-2.5-flash")))
    # A Gemini-shaped key with provider=grok goes only to xAI (never to Google).
    client.post("/api/models", headers=hdr("grok", GKEY))
    assert {c.url.host for c in calls} == {"api.x.ai"}
    assert client.post("/api/models", headers=hdr("nope", "k")).status_code == 503
    object.__setattr__(providers.settings, "allow_byok", False)
    r = client.post("/api/models", headers=hdr("gemini", GKEY))
    assert r.status_code == 503 and "does not accept" in r.json()["error"]["message"]


def test_server_managed_key_per_provider(monkeypatch):
    calls = mock(monkeypatch, lambda req: httpx.Response(200, json=gemini_models("gemini-2.5-flash") if req.method == "GET" else gemini_ok()))
    monkeypatch.setattr(type(providers.settings), "server_key", lambda self, p: "SERVERKEY" if p == "gemini" else "")
    assert client.post("/api/models", headers={"X-LLM-Provider": "gemini"}).status_code == 200
    assert calls[0].headers["x-goog-api-key"] == "SERVERKEY"
    assert client.post("/api/models", headers={"X-LLM-Provider": "grok"}).status_code == 503
    st = client.get("/api/health").json()["ai"]
    assert st["server_providers"] == ["gemini"] and "SERVERKEY" not in json.dumps(st)


@pytest.mark.parametrize("provider,key,model,reply", [
    ("gemini", GKEY, "gemini-2.5-flash", lambda t: gemini_ok(t)),
    ("grok", XKEY, "grok-4.3", lambda t: grok_ok(t)),
])
def test_chat_uses_provider_and_keeps_grounding(monkeypatch, provider, key, model, reply):
    sid = upload().json()["session_id"]
    north = int(pd.read_csv(io.StringIO(CSV)).query("region == 'North'")["units"].sum())
    texts = iter([json.dumps({"type": "plan", "operation": "group_aggregate", "params": {"group_by": "region", "target": "units", "agg": "sum"}}),
                  f"North has {north} units, and 987654 were returned."])  # second number is not in the result

    def handler(req):
        return httpx.Response(200, json=reply(next(texts)))
    mock(monkeypatch, handler)
    r = client.post(f"/api/sessions/{sid}/chat", json={"question": "Which region sold the most units?"}, headers=hdr(provider, key, model))
    b = r.json()
    assert r.status_code == 200, r.text
    assert b["type"] == "answer" and b["provider"] == provider and b["model"] == model
    assert b["explanation_source"] == "template" and "987654" in b["withheld_numbers"]  # numerical grounding still enforced
    assert key not in r.text
