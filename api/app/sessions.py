"""In-memory analysis sessions.

There are no accounts and no database: an upload creates a session identified by an
unguessable token. The DataFrame, its overview and the results computed from it live only in
this process's memory. Sessions expire after SESSION_TTL_MINUTES without activity, the oldest
idle session is evicted when MAX_SESSIONS is reached, a restart clears everything, and DELETE
removes a session immediately.
"""

from __future__ import annotations

import secrets
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

import pandas as pd

from .config import settings


@dataclass
class Session:
    id: str
    filename: str
    file_format: str
    df: pd.DataFrame
    overview: dict
    details: dict
    notes: list[str]
    created: float = field(default_factory=time.time)
    last_access: float = field(default_factory=time.time)
    results: list[dict] = field(default_factory=list)
    chat_history: list[dict] = field(default_factory=list)

    def touch(self) -> None:
        self.last_access = time.time()

    @property
    def expires_at(self) -> str:
        return datetime.fromtimestamp(self.last_access + settings.session_ttl_minutes * 60, timezone.utc).isoformat()

    def add_result(self, result: dict) -> dict:
        result = {"id": uuid.uuid4().hex[:12], "created": datetime.now(timezone.utc).isoformat(), **result}
        self.results.append(result)
        if len(self.results) > settings.max_results_per_session:
            self.results.pop(0)
        return result


class SessionStore:
    def __init__(self) -> None:
        self._s: dict[str, Session] = {}
        self._lock = threading.Lock()

    def _expired(self, s: Session) -> bool:
        return time.time() - s.last_access > settings.session_ttl_minutes * 60

    def cleanup(self) -> int:
        with self._lock:
            dead = [k for k, s in self._s.items() if self._expired(s)]
            for k in dead:
                del self._s[k]
            return len(dead)

    @staticmethod
    def _mb(df: pd.DataFrame) -> float:
        return float(df.memory_usage(deep=True).sum()) / 1e6

    def memory_mb(self) -> float:
        return sum(self._mb(s.df) for s in self._s.values())

    def create(self, **kw) -> Session:
        self.cleanup()
        need = self._mb(kw["df"])
        if need > settings.session_memory_budget_mb:
            raise MemoryError(f"This dataset needs about {need:.0f} MB in memory, more than this server allows per session.")
        with self._lock:
            # Evict least-recently-used sessions until both the count and the memory budget fit.
            while self._s and (len(self._s) >= settings.max_sessions or self.memory_mb() + need > settings.session_memory_budget_mb):
                oldest = min(self._s.values(), key=lambda s: s.last_access)
                del self._s[oldest.id]
            sid = secrets.token_urlsafe(24)
            s = Session(id=sid, **kw)
            self._s[sid] = s
            return s

    def get(self, sid: str) -> Session | None:
        with self._lock:
            s = self._s.get(sid)
            if s is None:
                return None
            if self._expired(s):
                del self._s[sid]
                return None
            s.touch()
            return s

    def delete(self, sid: str) -> bool:
        with self._lock:
            return self._s.pop(sid, None) is not None

    def __len__(self) -> int:
        return len(self._s)


store = SessionStore()
