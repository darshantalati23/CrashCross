"""Runtime settings, read once from environment variables (see ../../.env.example)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


def _bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    return default if v is None else v.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    environment: str = os.environ.get("ENVIRONMENT", "development")
    # Comma-separated list of browser origins allowed to call the API (the website's URL).
    allowed_origins: list[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
            if o.strip()
        ]
    )
    # Optional regex for extra origins, e.g. Vercel preview URLs: ^https://crashcross-[a-z0-9-]+\.vercel\.app$
    allowed_origin_regex: str | None = os.environ.get("ALLOWED_ORIGIN_REGEX") or None
    # Upload limits. Uploaded data lives only in server memory for the session's lifetime.
    max_upload_mb: int = _int("MAX_UPLOAD_MB", 10)
    max_rows: int = _int("MAX_ROWS", 200_000)
    max_columns: int = _int("MAX_COLUMNS", 300)
    # Sessions: idle expiry and a global cap (least-recently-used session evicted first).
    session_ttl_minutes: int = _int("SESSION_TTL_MINUTES", 60)
    # Total in-memory DataFrame budget across sessions (MB). Least-recently-used sessions are
    # evicted to make room; sized for a 512 MB instance (≈100 MB process + parse headroom).
    session_memory_budget_mb: int = _int("SESSION_MEMORY_BUDGET_MB", 240)
    max_sessions: int = _int("MAX_SESSIONS", 8)
    max_results_per_session: int = _int("MAX_RESULTS_PER_SESSION", 100)
    # Simple per-client-IP rate limits (requests per minute).
    upload_rate_per_min: int = _int("UPLOAD_RATE_PER_MIN", 10)
    chat_rate_per_min: int = _int("CHAT_RATE_PER_MIN", 12)
    # AI chat (optional). Server-managed key stays on the backend and is never returned.
    anthropic_api_key: str = os.environ.get("ANTHROPIC_API_KEY", "")
    gemini_api_key: str = os.environ.get("GEMINI_API_KEY", "")
    xai_api_key: str = os.environ.get("XAI_API_KEY", "")
    llm_model: str = os.environ.get("LLM_MODEL", "claude-opus-5-5")
    llm_effort: str = os.environ.get("LLM_EFFORT", "low")
    llm_timeout_seconds: int = _int("LLM_TIMEOUT_SECONDS", 60)
    llm_fallbacks: bool = _bool("LLM_FALLBACKS", True)
    # The SDK would otherwise honour an inherited ANTHROPIC_BASE_URL; pin it explicitly.
    llm_base_url: str = os.environ.get("LLM_BASE_URL", "https://api.anthropic.com")
    # Bring-your-own-key: when true, a browser may send its own provider key per request
    # (header X-LLM-Api-Key) for the provider they select. It is used for that request only and never stored or logged.
    allow_byok: bool = _bool("ALLOW_BYOK", False)

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    def server_key(self, provider: str) -> str:
        return {"anthropic": self.anthropic_api_key, "gemini": self.gemini_api_key, "grok": self.xai_api_key}.get(provider, "").strip()

    @property
    def server_providers(self) -> list[str]:
        return [p for p in ("anthropic", "gemini", "grok") if self.server_key(p)]

    @property
    def server_ai_configured(self) -> bool:
        return bool(self.server_providers)


settings = Settings()
