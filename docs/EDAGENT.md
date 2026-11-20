# EDAgent (website tab + `api/`)

A general-purpose EDA tool for a user's own dataset. It is independent of the crash research: it
never loads the export or the crash CSV.

## Implemented features

| Feature | Details |
| --- | --- |
| Import | `.csv`, `.tsv`, `.txt` (delimiter sniffed: comma/semicolon/tab/pipe; UTF-8/UTF-16 BOM, cp1252 fallback), `.json` (array of records; object wrapping one such array; object of equal-length column arrays; one nesting level flattened), `.jsonl`/`.ndjson`, `.xlsx` (first sheet; others listed; 150 MB uncompressed guard). Limits: 10 MB, 200,000 rows, 300 columns (env-configurable). URL import, databases, `.xls`, Parquet are **not** supported. |
| Type handling | Numbers/dates/booleans stored as text are converted when ≥ 98% / ≥ 95% parse; each conversion is reported. Column kinds: numeric, categorical, datetime, boolean, text, identifier. |
| Overview & quality | Rows, columns, duplicates, complete rows, missing cells, per-column stats/top values; warnings for duplicates, missingness > 20%/50%, constant columns, likely identifiers, mixed types, high cardinality, IQR outliers. |
| Visualise | Bar, histogram, line, scatter, box, correlation heatmap. Column pickers show unusable columns disabled with the reason; defaults chosen per chart type; invalid combinations rejected client-side and server-side with a clear message. Aggregation over all rows on the server; scatter sampled to 5,000 points with a note; box plots from computed quartiles; top-N without silent pooling. Each chart keeps its exact table. |
| Chat (optional) | See below. Disabled with an explanation when no key is configured. |
| Export | `report.html` (overview, columns, quality, every chart + table, chat answers with AI text labelled), `results.json`, `bundle.zip` (report, JSON, column profile, every result table as CSV with formula-injection guard). Generated from the session's actual results. |
| States | Server waking/unreachable (retry), loading, empty, validation errors, rate limits, expired/unknown session (re-upload prompt), delete session. |

## API

`GET /api/health` · `POST /api/sessions` (multipart `file`, optional `sheet`) · `GET|DELETE /api/sessions/{id}` ·
`GET /api/sessions/{id}/rows?offset&limit` · `POST /api/sessions/{id}/charts` · `DELETE /api/sessions/{id}/results/{rid}` ·
`POST /api/sessions/{id}/chat` · `GET /api/sessions/{id}/export/{report.html|results.json|bundle.zip}`.
OpenAPI docs at `/api/docs`. Errors: `{"error": {"code", "message"}}`.

## Chat design (grounded, no code execution)

1. **Plan** — the model receives column names, kinds, missing %, distinct counts and up to five example
   values per column (wrapped as data), the last four question/plan pairs, and the list of approved
   operations. It must return JSON: a plan (one operation + parameters), a clarification with options,
   or a decline (unrelated, unanswerable or missing data).
2. **Execute** — `operations.py` runs the approved operation (`overview`, `describe_column`,
   `value_counts`, `group_aggregate`, `correlation`, `missingness`, `crosstab`, `chart`) with validated
   columns. Unknown operations or columns are declined. No model output is ever executed as code.
3. **Explain** — the model gets the computed result (≤ 25 table rows) and writes 2–4 sentences.
4. **Ground** — every number in the explanation must match a number in the result or the question
   (allowing display rounding / ×100 for percentages). Otherwise the explanation is replaced by a
   deterministic summary and the offending numbers are shown as withheld.

Providers (`api/app/providers.py`, one small interface: `list_models` + `complete`; the planner and explanation steps are unchanged):

| Provider | Transport | Models |
| --- | --- | --- |
| Anthropic | official `anthropic` SDK (`anthropic==2.11.0`), `output_config.effort` = `LLM_EFFORT`, server-side refusal fallbacks (`LLM_FALLBACKS`) | `models.list`; default `LLM_MODEL` (`claude-opus-5-5`) |
| Gemini | REST `GET /v1beta/models`, `POST /v1beta/models/{model}:generateContent`, key in `x-goog-api-key` | models supporting `generateContent` |
| Grok (xAI) | REST `GET /v1/models`, `POST /v1/chat/completions`, `Authorization: Bearer` | `grok-*` text models |

The Chat tab has a provider selector, a model selector and a password field (shown when BYOK is enabled).
Gemini defaults to **Gemini 3.1 Flash Lite** (`gemini-3.1-flash-lite`), with immediately available presets for
Gemini 3.5 Flash Lite and Gemini 3 Flash Preview. These text models have a published free tier per
[Google's pricing](https://ai.google.dev/gemini-api/docs/pricing) (checked 2026-11-20); actual quotas/access
depend on the project, and a billed project may incur charges. Presets do not require discovery or a successful
check before chatting. Explicit model checks validate only the selected model, without listing models first.
**Auto** discovers models and ranks them (Gemini 3.1 Flash Lite first, then stable Lite/Flash before Pro; Grok the newest
version) and tries up to 3, reporting each skipped model and why; if none works it fails with that list.
The entire check has a 20-second backend deadline and a 25-second browser deadline covering response-body reads.
Checks can be cancelled; changing provider/key/model invalidates pending responses without locking the selector.
Regression checks: `cd web; node --test scripts/test-api-timeout.mjs`.
Errors are distinguished as
invalid key (`ai_auth`), unavailable model (`ai_model_unavailable`), rate limit, timeout, unavailable and declined. A key is only
ever sent to the provider the user selected (no guessing from key shape); provider hosts are fixed in code. Gemini/Grok get 3× the
output-token budget to leave room for hidden reasoning. Gemini/Grok were tested against mocked HTTP only.
Provider errors map to auth / rate-limit / timeout / unavailable messages; a refusal is reported as "declined".

What is sent to the provider: column metadata, a few example values per column, computed result tables.
Raw rows are not sent.

## API-key approach

- **Server-managed (default):** `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` and/or `XAI_API_KEY` set only in the backend environment. It is never
  returned by any endpoint (`/api/health` exposes only which providers are configured, as booleans/ids) or bundled in the site.
- **Bring-your-own-key (optional, `ALLOW_BYOK=true`, off by default):** the user selects a provider and types its key in the
  Chat tab; it is kept in React state only (not localStorage/sessionStorage), sent over HTTPS in the
  `X-LLM-Api-Key` header (with `X-LLM-Provider` / `X-LLM-Model`) with each chat request, used for that request only, and not stored or
  logged (uvicorn access logs do not include headers; the app never logs request headers). Provider base URLs are fixed by the server, so a key cannot be redirected to another host; provider error text is scrubbed of the key. Enable only behind HTTPS.
- **No key:** chat is shown as optional/not configured; all other features work.

## Session retention and cleanup

No accounts, no database, no durable storage. Parsed data and results live in process memory under an
unguessable token (`secrets.token_urlsafe(24)`), referenced from the browser's `sessionStorage`
(per tab). Sessions are removed after `SESSION_TTL_MINUTES` (60) without activity (checked on access
and by a 5-minute janitor), when `MAX_SESSIONS` (8) or the total in-memory budget `SESSION_MEMORY_BUDGET_MB` (240) would be exceeded (least recently used first; a single dataset larger than the budget is refused with HTTP 413), on
`DELETE`, and on any restart/redeploy/spin-down. Uploads are buffered transiently by the web
framework while being received. Uploads are parsed one at a time to bound peak memory. Rate limits: 10 uploads/min and 12 chat requests/min per client IP.
