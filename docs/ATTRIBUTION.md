# Attribution and reuse

## EDAgent reference repository

Source: <https://github.com/ExploratoryDataAnalysis/EDAgent> (same organization), read from a
temporary clone; the source repository was not modified. No LICENSE file was found in that repository,
so no licence notice could be carried over; reuse is limited to adapted designs and small patterns within
the same organization's project. If a licence is later added there, record it here.

Adapted (rewritten, not copied verbatim):

- Chat architecture "the backend computes every number; AI only plans and explains", planner rules
  (data-not-instructions, clarify/decline, follow-up reuse) — from `backend/app/services/ai/prompts.py`
  and `grounding.py`; here extended with a numeric grounding check on free-text explanations.
- Provider error categories (auth / rate limit / timeout / unavailable) — from `services/ai/llm.py`;
  here implemented with the official `anthropic` SDK exception classes.
- Supported-format ideas (delimiter sniffing, zip-bomb guard for XLSX, formula-injection-safe CSV) —
  from `services/ingestion/` and `services/export/`.

Not reused: accounts/JWT, database/Alembic, job runner, road-safety pages, the 27-operation engine,
the existing chart page UI (replaced by a validated chart builder).

## Third-party software (via npm / pip)

React, React Router, Vite, Tailwind CSS (MIT); Plotly.js (MIT); pdf.js (Apache-2.0); lucide-react (ISC);
FastAPI, Starlette, Uvicorn, pandas, NumPy, openpyxl (BSD/MIT-style); anthropic Python SDK (MIT).
Fonts: Source Sans 3, Source Serif 4, JetBrains Mono via Google Fonts (OFL).

## Data

WPRDC *Allegheny County Crash Data* (publisher metadata snapshot lists Creative Commons CCZero).
PennDOT codebooks are linked at their publishers, not redistributed.
