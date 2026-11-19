"""Small helpers: JSON-safe conversion and rate limiting."""

from __future__ import annotations

import math
import time
from collections import defaultdict, deque
from datetime import date, datetime
from typing import Any

import numpy as np
import pandas as pd


def clean(v: Any) -> Any:
    """Convert numpy/pandas values to JSON-safe Python; NaN/inf/NaT become None."""
    if isinstance(v, dict):
        return {str(k): clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [clean(x) for x in v]
    if isinstance(v, np.ndarray):
        return [clean(x) for x in v.tolist()]
    if v is None or v is pd.NaT:
        return None
    if isinstance(v, (np.bool_, bool)):
        return bool(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating, float)):
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    if isinstance(v, (pd.Timestamp, datetime, date)):
        return v.isoformat()
    if isinstance(v, (pd.Timedelta,)):
        return str(v)
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v if isinstance(v, (str, int)) else str(v)


class RateLimiter:
    """Sliding one-minute window per key. In-memory, per process."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, per_minute: int) -> bool:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= per_minute:
            return False
        q.append(now)
        if len(self._hits) > 10_000:  # bound memory
            for k in list(self._hits)[:5_000]:
                if not self._hits[k]:
                    del self._hits[k]
        return True


limiter = RateLimiter()
