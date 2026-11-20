"""LLM providers behind one small interface (Anthropic, Gemini, Grok).

Each provider can list the models a key can use and run one text completion. The planner and
explanation steps in `chat.py` only use `Provider.complete`. A key is only ever sent to the provider
the caller selected explicitly (never guessed from the key's shape). Keys are used for the single
call, never stored, cached or logged, and are scrubbed from any provider error text.

Endpoints (official docs):
- Gemini: GET /v1beta/models, POST /v1beta/models/{model}:generateContent, key in `x-goog-api-key`.
- Grok (xAI): GET /v1/models, POST /v1/chat/completions (OpenAI-compatible), `Authorization: Bearer`.
- Anthropic: official `anthropic` SDK (Messages API, models.list).
"""

from __future__ import annotations

import re
from typing import Any

import anthropic
import httpx

from .config import settings


class ChatUnavailable(Exception):
    pass


class ChatProviderError(Exception):
    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind
        self.message = message


# Test hook: an httpx transport (e.g. httpx.MockTransport) used instead of the network.
_transport: httpx.AsyncBaseTransport | None = None

# Hosts are fixed here (not configurable per request), so a key cannot be redirected elsewhere.
GEMINI_BASE = "https://generativelanguage.googleapis.com"
XAI_BASE = "https://api.x.ai"
AUTO_ATTEMPTS = 3          # how many ranked models "Auto" tries before giving up
PING_TOKENS = 16           # minimal validation request


def _scrub(text: str, key: str) -> str:
    return text.replace(key, "[key]") if key else text


def _http_error(status: int, body: Any, key: str) -> ChatProviderError:
    err = body.get("error") if isinstance(body, dict) else None
    msg = _scrub(str((err.get("message") if isinstance(err, dict) else err) or ""), key)[:160]
    low = msg.lower()
    if status in (401, 403) or "api key not valid" in low or "api_key_invalid" in low or "incorrect api key" in low:
        return ChatProviderError("auth", "The AI provider rejected the API key.")
    if status == 404:
        return ChatProviderError("model_unavailable", "The selected model is not available for this key.")
    if status == 429:
        return ChatProviderError("rate_limit", "The AI provider is rate-limiting requests; try again shortly.")
    if status in (400, 422):
        return ChatProviderError("configuration", f"The AI provider rejected the request ({msg}).")
    return ChatProviderError("unavailable", f"The AI provider returned an error (HTTP {status}).")


def _version(model_id: str, prefix: str) -> float:
    m = re.search(prefix + r"-(\d+(?:\.\d+)?)", model_id)
    return float(m.group(1)) if m else 0.0


class Provider:
    name = ""
    label = ""
    key_hint = ""

    async def list_models(self, key: str) -> list[str]:
        raise NotImplementedError

    async def complete(self, key: str, model: str, system: str, user: str, max_tokens: int, *, require_text: bool = True) -> str:
        raise NotImplementedError

    def rank(self, ids: list[str]) -> list[str]:
        """Usable models in the order Auto should try them."""
        return sorted(ids)

    # Reasoning models can spend part of the output budget on hidden thinking; leave headroom.
    @staticmethod
    def _budget(n: int) -> int:
        return n * 3


class _Http(Provider):
    base = ""

    def _headers(self, key: str) -> dict[str, str]:
        raise NotImplementedError

    async def _call(self, key: str, method: str, path: str, json_body: dict | None = None) -> dict:
        try:
            async with httpx.AsyncClient(base_url=self.base, timeout=settings.llm_timeout_seconds, transport=_transport) as c:
                r = await c.request(method, path, headers=self._headers(key), json=json_body)
        except httpx.TimeoutException:
            raise ChatProviderError("timeout", "The AI provider did not respond in time.") from None
        except httpx.HTTPError:
            raise ChatProviderError("unavailable", "Could not reach the AI provider.") from None
        try:
            body = r.json()
        except ValueError:
            body = None
        if r.status_code >= 400:
            raise _http_error(r.status_code, body, key)
        if not isinstance(body, dict):
            raise ChatProviderError("bad_response", "The AI provider returned an unreadable response.")
        return body


class Gemini(_Http):
    name, label, key_hint, base = "gemini", "Google Gemini", "AIza…", GEMINI_BASE

    def _headers(self, key):
        return {"x-goog-api-key": key}

    async def list_models(self, key):
        ids: list[str] = []
        token = None
        for _ in range(5):
            path = "/v1beta/models?pageSize=1000" + (f"&pageToken={token}" if token else "")
            body = await self._call(key, "GET", path)
            for m in body.get("models", []):
                if "generateContent" in (m.get("supportedGenerationMethods") or []):
                    ids.append(str(m.get("name", "")).removeprefix("models/"))
            token = body.get("nextPageToken")
            if not token:
                break
        return [i for i in ids if i]

    def rank(self, ids):
        skip = re.compile(r"embed|image|tts|audio|live|imagen|veo|aqa|robotics|computer|learnlm|gemma|native|dialog|banana|lyria|deep-research")
        ok = [i for i in ids if i.startswith("gemini") and not skip.search(i)]
        tier = lambda i: 2 if "lite" in i else 0 if "flash" in i else 1 if "pro" in i else 3
        return sorted(ok, key=lambda i: (bool(re.search(r"preview|exp", i)), tier(i), -_version(i, "gemini"), i))

    async def complete(self, key, model, system, user, max_tokens, *, require_text=True):
        body = await self._call(key, "POST", f"/v1beta/models/{model}:generateContent", {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"maxOutputTokens": self._budget(max_tokens)},
        })
        block = (body.get("promptFeedback") or {}).get("blockReason")
        cands = body.get("candidates") or []
        if block or (cands and cands[0].get("finishReason") in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII")):
            raise ChatProviderError("refusal", "The AI provider declined to answer this request.")
        parts = ((cands[0].get("content") or {}).get("parts") or []) if cands else []
        text = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought"))
        if require_text and not text.strip():
            raise ChatProviderError("bad_response", "The AI provider returned no text.")
        return text


class Grok(_Http):
    name, label, key_hint, base = "grok", "xAI Grok", "xai-…", XAI_BASE

    def _headers(self, key):
        return {"Authorization": f"Bearer {key}"}

    async def list_models(self, key):
        body = await self._call(key, "GET", "/v1/models")
        return [str(m["id"]) for m in body.get("data", []) if isinstance(m, dict) and m.get("id")]

    def rank(self, ids):
        ok = [i for i in ids if i.startswith("grok") and not re.search(r"image|imagine|video|embed|multi-agent", i)]
        reasoning = lambda i: "reasoning" in i and "non-reasoning" not in i
        return sorted(ok, key=lambda i: (-_version(i, "grok"), reasoning(i), i))

    async def complete(self, key, model, system, user, max_tokens, *, require_text=True):
        body = await self._call(key, "POST", "/v1/chat/completions", {
            "model": model, "max_completion_tokens": self._budget(max_tokens),
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        })
        choice = (body.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        if msg.get("refusal"):
            raise ChatProviderError("refusal", "The AI provider declined to answer this request.")
        text = msg.get("content") or ""
        if require_text and not text.strip():
            raise ChatProviderError("bad_response", "The AI provider returned no text.")
        return text


def anthropic_client(key: str) -> anthropic.AsyncAnthropic:
    # The SDK would otherwise honour an inherited ANTHROPIC_BASE_URL; pin it explicitly.
    return anthropic.AsyncAnthropic(api_key=key, base_url=settings.llm_base_url, timeout=settings.llm_timeout_seconds, max_retries=1)


class Anthropic(Provider):
    name, label, key_hint = "anthropic", "Anthropic Claude", "sk-ant-…"

    async def _guard(self, call):
        try:
            return await call
        except anthropic.AuthenticationError:
            raise ChatProviderError("auth", "The AI provider rejected the API key.") from None
        except anthropic.PermissionDeniedError:
            raise ChatProviderError("auth", "The API key is not permitted to use the selected model.") from None
        except anthropic.NotFoundError:
            raise ChatProviderError("model_unavailable", "The selected model is not available for this key.") from None
        except anthropic.RateLimitError:
            raise ChatProviderError("rate_limit", "The AI provider is rate-limiting requests; try again shortly.") from None
        except anthropic.BadRequestError as e:
            raise ChatProviderError("configuration", f"The AI provider rejected the request ({getattr(e, 'message', '')[:160]}).") from None
        except anthropic.APITimeoutError:
            raise ChatProviderError("timeout", "The AI provider did not respond in time.") from None
        except anthropic.APIConnectionError:
            raise ChatProviderError("unavailable", "Could not reach the AI provider.") from None
        except anthropic.APIStatusError as e:
            raise ChatProviderError("unavailable", f"The AI provider returned an error (HTTP {e.status_code}).") from None

    async def list_models(self, key):
        page = await self._guard(anthropic_client(key).models.list(limit=100))
        return [m.id for m in page.data]

    def rank(self, ids):
        first = [settings.llm_model] if settings.llm_model in ids else []
        return first + sorted((i for i in ids if i not in first), reverse=True)

    async def complete(self, key, model, system, user, max_tokens, *, require_text=True):
        client = anthropic_client(key)
        kwargs: dict[str, Any] = dict(model=model, max_tokens=max_tokens, system=system,
                                      messages=[{"role": "user", "content": user}],
                                      output_config={"effort": settings.llm_effort})
        if settings.llm_fallbacks:
            resp = await self._guard(client.beta.messages.create(betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs))
        else:
            resp = await self._guard(client.messages.create(**kwargs))
        if resp.stop_reason == "refusal":
            raise ChatProviderError("refusal", "The AI provider declined to answer this request.")
        text = "".join(getattr(b, "text", "") for b in resp.content if getattr(b, "type", "") == "text")
        if require_text and not text.strip():
            raise ChatProviderError("bad_response", "The AI provider returned no text.")
        return text


PROVIDERS: dict[str, Provider] = {p.name: p for p in (Anthropic(), Gemini(), Grok())}


def get_provider(name: str | None) -> Provider:
    p = PROVIDERS.get((name or "anthropic").strip().lower())
    if not p:
        raise ChatUnavailable(f"Unknown AI provider '{(name or '')[:30]}'. Choose one of: {', '.join(PROVIDERS)}.")
    return p


def resolve_key(provider: Provider, byok_key: str | None) -> str:
    """The user's per-request key (if the server allows it) or the server-managed key for this provider."""
    if byok_key:
        if not settings.allow_byok:
            raise ChatUnavailable("This server does not accept user-supplied API keys.")
        return byok_key
    server = settings.server_key(provider.name)
    if not server:
        raise ChatUnavailable(f"AI chat is not configured for {provider.label} on this server.")
    return server


async def _validate(p: Provider, key: str, model: str) -> None:
    await p.complete(key, model, "Reply with OK.", "ping", PING_TOKENS, require_text=False)


async def resolve_model(p: Provider, key: str, model: str | None) -> dict:
    """Discover the key's models, then validate the chosen one (or pick a working one for Auto) with a minimal request."""
    available = await p.list_models(key)
    if model and model.lower() != "auto":
        if model not in available:
            raise ChatProviderError("model_unavailable", f"{model} is not available for this {p.label} key.")
        await _validate(p, key, model)
        return {"provider": p.name, "model": model, "auto": False, "models": sorted(available), "failures": []}
    failures: list[dict] = []
    for cand in p.rank(available)[:AUTO_ATTEMPTS]:
        try:
            await _validate(p, key, cand)
            return {"provider": p.name, "model": cand, "auto": True, "models": sorted(available), "failures": failures}
        except ChatProviderError as e:
            if e.kind == "auth":
                raise
            failures.append({"model": cand, "reason": e.message})
    tried = "; ".join(f"{f['model']} ({f['reason']})" for f in failures) or "no supported chat models were listed for this key"
    raise ChatProviderError("model_unavailable", f"Auto could not find a working {p.label} model. Tried: {tried}")
