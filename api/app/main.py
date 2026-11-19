"""EDAgent API — analysis of user-uploaded datasets only (independent of the crash research).

Run locally:  uvicorn app.main:app --app-dir api --port 8000
"""

from __future__ import annotations

import asyncio
import logging
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from . import chat as chat_mod
from .charts import ChartError, build_chart
from .config import settings
from .ingest import SUPPORTED_EXTENSIONS, IngestError, parse_upload
from .profile import build_overview, preview
from .report import bundle_zip, html_report, results_json
from .sessions import store
from .util import clean, limiter

log = logging.getLogger("edagent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async def janitor():
        while True:
            await asyncio.sleep(300)
            n = store.cleanup()
            if n:
                log.info("expired %d idle session(s)", n)

    task = asyncio.create_task(janitor())
    yield
    task.cancel()


# One upload is parsed at a time: parsing briefly needs ~2x the final DataFrame size, and the
# free instance has 512 MB. Concurrent uploads wait instead of exhausting memory.
_parse_lock = asyncio.Semaphore(1)

app = FastAPI(title="EDAgent API", version="1.0.0", lifespan=lifespan, docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_origin_regex=settings.allowed_origin_regex,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "X-LLM-Api-Key"],
    expose_headers=["Content-Disposition"],
    max_age=600,
)


def _ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else request.client.host if request.client else "unknown")


def _err(status: int, code: str, message: str):
    raise HTTPException(status_code=status, detail={"code": code, "message": message})


def _session(sid: str):
    s = store.get(sid)
    if not s:
        _err(404, "session_not_found", "This analysis session has expired or does not exist. Upload the file again to start a new session.")
    return s


def _session_payload(s) -> dict:
    return clean({"session_id": s.id, "filename": s.filename, "format": s.file_format, "details": s.details, "notes": s.notes,
                  "overview": s.overview, "expires_at": s.expires_at, "ttl_minutes": settings.session_ttl_minutes,
                  "results": s.results})


@app.get("/api/health")
def health():
    return {"status": "ok", "sessions": len(store), "session_memory_mb": round(store.memory_mb(), 1), "ai": chat_mod.ai_status(),
            "limits": {"max_upload_mb": settings.max_upload_mb, "max_rows": settings.max_rows, "max_columns": settings.max_columns,
                       "session_ttl_minutes": settings.session_ttl_minutes, "session_memory_budget_mb": settings.session_memory_budget_mb, "supported_extensions": sorted(SUPPORTED_EXTENSIONS)}}


@app.post("/api/sessions")
async def create_session(request: Request, file: UploadFile = File(...), sheet: str | None = Form(None)):
    if not limiter.allow("up:" + _ip(request), settings.upload_rate_per_min):
        _err(429, "rate_limited", "Too many uploads; wait a minute and try again.")
    raw = await file.read(settings.max_upload_bytes + 1)
    name = re.sub(r"[^\w.\- ()]", "_", (file.filename or "upload"))[:120]
    try:
        async with _parse_lock:
            parsed = await asyncio.to_thread(parse_upload, name, raw, sheet)
            overview = await asyncio.to_thread(build_overview, parsed.df)
    except IngestError as e:
        _err(422, "invalid_file", str(e))
    del raw
    try:
        s = store.create(filename=name, file_format=parsed.file_format, df=parsed.df, overview=overview, details=parsed.details, notes=parsed.notes)
    except MemoryError as e:
        _err(413, "too_large_in_memory", str(e) + " Try a smaller extract or fewer columns.")
    log.info("session created: %s rows x %s cols (%s)", overview["rows"], overview["columns"], parsed.file_format)
    return _session_payload(s)


@app.get("/api/sessions/{sid}")
def get_session(sid: str):
    return _session_payload(_session(sid))


@app.delete("/api/sessions/{sid}")
def delete_session(sid: str):
    store.delete(sid)
    return {"deleted": True}


@app.get("/api/sessions/{sid}/rows")
def rows(sid: str, offset: int = 0, limit: int = 50):
    s = _session(sid)
    return preview(s.df, max(0, offset), limit)


class ChartSpec(BaseModel):
    chart_type: str
    x: str | None = None
    y: str | None = None
    color: str | None = None
    agg: str | None = None
    bins: int | None = None
    top_n: int | None = None
    interval: str | None = None
    sort: str | None = None
    columns: list[str] | None = None
    method: str | None = None
    include_missing: bool | None = True
    save: bool = True


@app.post("/api/sessions/{sid}/charts")
async def chart(sid: str, spec: ChartSpec):
    s = _session(sid)
    try:
        res = await asyncio.to_thread(build_chart, s.df, spec.model_dump(exclude={"save"}))
    except ChartError as e:
        _err(422, "invalid_chart", str(e))
    return s.add_result(res) if spec.save else res


@app.delete("/api/sessions/{sid}/results/{rid}")
def delete_result(sid: str, rid: str):
    s = _session(sid)
    s.results = [r for r in s.results if r["id"] != rid]
    return {"deleted": True}


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


@app.post("/api/sessions/{sid}/chat")
async def chat(sid: str, body: ChatIn, request: Request, x_llm_api_key: str | None = Header(default=None)):
    s = _session(sid)
    if not limiter.allow("chat:" + _ip(request), settings.chat_rate_per_min):
        _err(429, "rate_limited", "Too many chat requests; wait a minute and try again.")
    key = (x_llm_api_key or "").strip() or None
    try:
        out = await chat_mod.answer(body.question.strip(), s.filename, s.df, s.overview, s.chat_history, key)
    except chat_mod.ChatUnavailable as e:
        _err(503, "ai_unavailable", str(e))
    except chat_mod.ChatProviderError as e:
        _err(502, f"ai_{e.kind}", e.message)
    s.chat_history.append({"question": body.question, "plan": out.get("plan")})
    record = {"kind": "chat", "question": body.question, **{k: v for k, v in out.items() if k != "plan"}}
    if out["type"] == "answer":
        return s.add_result(record)
    return clean(record)


EXPORTS = {
    "report.html": ("text/html; charset=utf-8", lambda s: html_report(s).encode()),
    "results.json": ("application/json", lambda s: results_json(s).encode()),
    "bundle.zip": ("application/zip", bundle_zip),
}


@app.get("/api/sessions/{sid}/export/{kind}")
def export(sid: str, kind: str):
    s = _session(sid)
    if kind not in EXPORTS:
        _err(404, "unknown_export", "Unknown export type.")
    media, fn = EXPORTS[kind]
    base = re.sub(r"\.[^.]+$", "", s.filename) or "dataset"
    return Response(fn(s), media_type=media, headers={"Content-Disposition": f'attachment; filename="edagent_{base}_{kind}"'})


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content={"error": detail})


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(x) for x in first.get("loc", [])[1:])
    return JSONResponse(status_code=422, content={"error": {"code": "invalid_request", "message": f"Invalid request{(' field ' + where) if where else ''}: {first.get('msg', 'validation failed')}."}})


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("unhandled error")
    return JSONResponse(status_code=500, content={"error": {"code": "internal", "message": "Unexpected server error while processing the request."}})
