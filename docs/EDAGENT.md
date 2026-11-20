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
| Full-table search | Rows tab: select a column, Equals/Contains/Starts with and a value. Searches the complete upload before pagination, with case/space normalization; no AI key or AI quota required. Duplicate matches stay separate. |
| Export | `report.html` (overview, columns, quality, every chart + table, chat answers with AI text labelled), `results.json`, `bundle.zip` (report, JSON, column profile, every result table as CSV with formula-injection guard). Generated from the session's actual results. |
| States | Server waking/unreachable (retry), loading, empty, validation errors, rate limits, expired/unknown session (re-upload prompt), delete session. |

## API

`GET /api/health` · `POST /api/sessions` (multipart `file`, optional `sheet`) · `GET|DELETE /api/sessions/{id}` ·
`GET /api/sessions/{id}/rows?offset&limit` ·
`POST /api/sessions/{id}/rows/search?offset&limit` (JSON: `{column,value,match?}`, `match=eq|contains|starts_with`; search values stay out of URL logs) ·
`POST /api/sessions/{id}/charts` · `DELETE /api/sessions/{id}/results/{rid}` ·
`POST /api/sessions/{id}/chat` · `GET /api/sessions/{id}/export/{report.html|results.json|bundle.zip}`.
OpenAPI docs at `/api/docs`. Errors: `{"error": {"code", "message"}}`.

## Chat design (grounded, no code execution)

1. **Plan** — the model receives column names, kinds, missing %, distinct counts and up to five example
   values per column (wrapped as data), the last four question/plan pairs, and the list of approved
   operations. It must return JSON: a plan (one operation + parameters), a clarification with options,
   or a decline (unrelated, unanswerable or missing data). All uploaded column names are included;
   the example values are explicitly not an exhaustive list. Named-record questions must use `lookup_rows`.
2. **Execute** — `operations.py` runs the approved operation (`overview`, `describe_column`,
   `lookup_rows`, `value_counts`, `group_aggregate`, `correlation`, `missingness`, `crosstab`, `chart`) with validated
   columns and parameters. Up to 10 filters are applied to the **whole uploaded table before** sorting, statistics,
   aggregation or pagination. Unknown operations/parameters/columns are declined; no generated code/SQL runs.
   CPU work runs outside the async event loop. Each result records rows searched/matched, results returned/total,
   whether the scan completed and whether output is truncated. Lookup output is capped at 100 records per page.
3. **Explain** — lookups receive an exact server-written answer, without an explanation API call. Multiple matches
   are shown separately with identifying fields; zero matches means these filters found nothing in the full upload,
   not that spelling variants were exhaustively resolved. Partial/oversized result tables also use server summaries,
   explicitly warning that absence from a partial table does not establish absence from the dataset.
   Other complete, compact results (≤ 25 table rows, ≤ 12,000 characters) can receive a 2–4 sentence AI explanation.
4. **Ground** — every number in the explanation must match a number in the result or the question
   (allowing display rounding / ×100 for percentages). Otherwise the explanation is replaced by a
   deterministic summary and the offending numbers are shown as withheld. Explanation-provider failures also retain
   the computed result with a server summary. The UI says "numbers checked": numerical consistency does not prove
   every semantic claim. Natural-language planning still requires a provider call; use Rows search if quota is exhausted.

### Query scope and limits

All operations accept `filters: [{column, op, value}]` and `filter_mode: "all"|"any"` (AND/OR).
Approved comparisons: `eq`, `ne`, `in` (up to 100 values), `contains`, `starts_with`, `gt`, `gte`, `lt`, `lte`,
`is_null`, `not_null`. Missing values match only explicit null filters. Text equality ignores case, Unicode width
differences and repeated spaces; contains/starts_with are literal, not regular expressions. Ordered comparisons
require numbers or dates; large integer identifiers remain exact during filtering and leading-zero text stays text.

For example, a synthetic lookup plan is:

```json
{"type":"plan","operation":"lookup_rows","params":{"filters":[{"column":"Student Name","op":"eq","value":"Example Student"}],"columns":["Roll No","Total Marks"],"limit":50,"offset":0}}
```

`lookup_rows` also accepts `sort_by` and `sort_desc` for sorted/ranked row lists. The other approved operations accept
the same filters for subset calculations. This is a bounded filter → calculate/sort → page pipeline, not an arbitrary
multi-step agent. Unsupported calculations should request clarification; fuzzy spelling correction is not automatic.
The existing 10 MB / 200k-row / 300-column and server-memory limits remain. No sandbox, vector database, embeddings
or paid retrieval service is needed. Backend search uses no LLM calls; provider free tiers are quota-limited, not unlimited.

Tests: `api/.venv/Scripts/python -m pytest api/tests -q`, plus the frontend regressions listed below. The uploaded
workbook was checked locally without alteration; committed regressions contain only synthetic records.

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
