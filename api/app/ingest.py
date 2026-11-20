"""Parse an uploaded file into a DataFrame, with explicit formats and limits.

Supported: .csv, .tsv, .txt (delimited text), .json (array of records, an object wrapping one
such array, or an object of equal-length column arrays), .jsonl/.ndjson (one object per line),
.xlsx (first sheet unless another is chosen). Nothing else is accepted, and URLs are not fetched.
"""

from __future__ import annotations

import csv
import io
import json
import re
import zipfile
from dataclasses import dataclass, field

import pandas as pd

from .config import settings

SUPPORTED_EXTENSIONS = {".csv", ".tsv", ".txt", ".json", ".jsonl", ".ndjson", ".xlsx"}
MAX_XLSX_UNCOMPRESSED = 150 * 1024 * 1024


class IngestError(ValueError):
    """A user-facing reason why the file could not be loaded."""


@dataclass
class Parsed:
    df: pd.DataFrame
    file_format: str
    details: dict = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def _ext(name: str) -> str:
    m = re.search(r"(\.[A-Za-z0-9]+)$", name or "")
    return m.group(1).lower() if m else ""


def _decode(raw: bytes) -> tuple[str, str]:
    encodings = ("utf-16",) if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else ("utf-8-sig",)
    for enc in encodings:
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            pass
    return raw.decode("cp1252", errors="replace"), "cp1252 (fallback)"


def _parse_delimited(raw: bytes, ext: str) -> Parsed:
    text, enc = _decode(raw)
    if not text.strip():
        raise IngestError("The file is empty.")
    sample = text[:65536]
    if ext == ".tsv":
        sep = "\t"
    else:
        try:
            sep = csv.Sniffer().sniff(sample, delimiters=",;\t|").delimiter
        except csv.Error:
            sep = ","
    try:
        # Read every cell as text; _tidy() converts columns only when it is lossless (keeps leading zeros).
        df = pd.read_csv(io.StringIO(text), sep=sep, dtype=str, keep_default_na=True, nrows=settings.max_rows + 1)
    except (pd.errors.ParserError, ValueError) as e:
        raise IngestError(f"Could not parse the file as delimited text: {str(e)[:200]}") from None
    names = {",": "comma", ";": "semicolon", "\t": "tab", "|": "pipe"}
    return Parsed(df, "TSV" if sep == "\t" else "CSV", {"delimiter": names.get(sep, sep), "encoding": enc})


def _records_from_json(obj) -> tuple[pd.DataFrame, str]:
    if isinstance(obj, list):
        if not obj:
            raise IngestError("The JSON array is empty.")
        if not all(isinstance(r, dict) for r in obj[:1000]):
            raise IngestError("A JSON array must contain objects (one object per row).")
        return pd.json_normalize(obj, max_level=1), "array of records"
    if isinstance(obj, dict):
        lists = {k: v for k, v in obj.items() if isinstance(v, list)}
        if len(lists) == 1:
            key, arr = next(iter(lists.items()))
            if arr and all(isinstance(r, dict) for r in arr[:1000]):
                return pd.json_normalize(arr, max_level=1), f'records under key "{key}"'
        if obj and all(isinstance(v, list) for v in obj.values()):
            lens = {len(v) for v in obj.values()}
            if len(lens) == 1:
                return pd.DataFrame(obj), "object of column arrays"
    raise IngestError(
        "Unsupported JSON layout. Use an array of objects, an object containing exactly one such array, "
        "or an object whose values are equal-length column arrays."
    )


def _parse_json(raw: bytes) -> Parsed:
    text, _ = _decode(raw)
    try:
        obj = json.loads(text)
    except json.JSONDecodeError as e:
        raise IngestError(f"Invalid JSON: {e.msg} (line {e.lineno}, column {e.colno}).") from None
    df, layout = _records_from_json(obj)
    return Parsed(df, "JSON", {"layout": layout})


def _parse_jsonl(raw: bytes) -> Parsed:
    text, _ = _decode(raw)
    rows = []
    for i, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError as e:
            raise IngestError(f"Invalid JSON on line {i}: {e.msg}.") from None
        if not isinstance(r, dict):
            raise IngestError(f"Line {i} is not a JSON object.")
        rows.append(r)
        if len(rows) > settings.max_rows:
            break
    if not rows:
        raise IngestError("The file contains no JSON objects.")
    return Parsed(pd.json_normalize(rows, max_level=1), "JSON Lines")


def _parse_xlsx(raw: bytes, sheet: str | None) -> Parsed:
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            if sum(i.file_size for i in z.infolist()) > MAX_XLSX_UNCOMPRESSED:
                raise IngestError("The workbook expands to more than 150 MB and was rejected.")
    except zipfile.BadZipFile:
        raise IngestError("The file is not a valid .xlsx workbook.") from None
    try:
        xl = pd.ExcelFile(io.BytesIO(raw), engine="openpyxl")
    except Exception as e:  # openpyxl raises a variety of errors on malformed files
        raise IngestError(f"Could not open the workbook: {str(e)[:200]}") from None
    sheets = xl.sheet_names
    chosen = sheet if sheet in sheets else sheets[0]
    df = xl.parse(chosen, nrows=settings.max_rows + 1)
    notes = [f'Loaded sheet "{chosen}" ({len(sheets)} sheet(s) in workbook).'] if len(sheets) > 1 else []
    return Parsed(df, "Excel (.xlsx)", {"sheet": chosen, "sheets": sheets}, notes)


def _tidy(p: Parsed) -> Parsed:
    df = p.df
    # Column names: strings, stripped, unique, never empty.
    seen: dict[str, int] = {}
    cols = []
    for i, c in enumerate(df.columns):
        name = str(c).strip() if c is not None and str(c).strip() and not str(c).startswith("Unnamed:") else f"column_{i + 1}"
        if name in seen:
            seen[name] += 1
            name = f"{name}_{seen[name]}"
        else:
            seen[name] = 0
        cols.append(name)
    renamed = [f"{orig} → {new}" for orig, new in zip(map(str, df.columns), cols) if str(orig).strip() != new]
    df.columns = cols
    if renamed:
        p.notes.append("Column names adjusted to be unique and non-empty: " + "; ".join(renamed[:10]) + ("…" if len(renamed) > 10 else "") + ".")
    df = df.dropna(how="all")
    if df.empty or len(df.columns) == 0:
        raise IngestError("No data rows were found in the file.")
    if len(df) > settings.max_rows:
        raise IngestError(f"The file has more than {settings.max_rows:,} rows, the limit for this service.")
    if len(df.columns) > settings.max_columns:
        raise IngestError(f"The file has {len(df.columns)} columns; the limit is {settings.max_columns}.")
    conversions, preserved = [], []
    textual = p.file_format in ("CSV", "TSV")  # every cell arrived as text
    for c in df.columns:
        s = df[c]
        if s.dtype != object:
            continue
        non_null = s.dropna()
        if non_null.empty:
            continue
        as_str = non_null.astype(str).str.strip()
        # Codes such as ZIP codes or phone numbers: keep as text when any value has a leading zero.
        if as_str.str.match(r"^[+-]?0\d").any():
            if pd.to_numeric(as_str, errors="coerce").notna().all():
                preserved.append(c)
            continue
        # Numbers stored as text: convert only when EVERY value parses (no silent loss).
        thousands = as_str.str.match(r"^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$")
        cleaned = as_str.where(~thousands, as_str.str.replace(",", "", regex=False))
        num = pd.to_numeric(cleaned, errors="coerce")
        if num.notna().all():
            df[c] = num.reindex(s.index)
            if not textual or thousands.any():
                conversions.append(f"{c}: text → number" + (" (thousands separators removed)" if thousands.any() else ""))
            continue
        # Dates stored as text: every value must parse.
        if as_str.str.match(r"^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}").all():
            dt = pd.to_datetime(as_str, errors="coerce", format="mixed")
            if dt.notna().all():
                df[c] = dt.reindex(s.index)
                conversions.append(f"{c}: text → date/time")
                continue
        # Booleans stored as text.
        low = set(as_str.str.lower().unique())
        if low and low <= {"true", "false"}:
            df[c] = s.map(lambda v: None if pd.isna(v) else str(v).strip().lower() == "true").astype("boolean")
            conversions.append(f"{c}: text → boolean")
    p.df = df.reset_index(drop=True)
    if conversions:
        p.notes.append("Automatic type conversions: " + "; ".join(conversions) + ".")
    if preserved:
        p.notes.append("Kept as text to preserve leading zeros: " + ", ".join(preserved) + ".")
    return p


def parse_upload(filename: str, raw: bytes, sheet: str | None = None) -> Parsed:
    ext = _ext(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise IngestError(
            f'Unsupported file type "{ext or "none"}". Supported: CSV, TSV/TXT (delimited), JSON, JSON Lines, Excel .xlsx.'
        )
    if not raw:
        raise IngestError("The file is empty.")
    if len(raw) > settings.max_upload_bytes:
        raise IngestError(f"The file is larger than the {settings.max_upload_mb} MB limit.")
    if ext in {".csv", ".tsv", ".txt"}:
        p = _parse_delimited(raw, ext)
    elif ext == ".json":
        p = _parse_json(raw)
    elif ext in {".jsonl", ".ndjson"}:
        p = _parse_jsonl(raw)
    else:
        p = _parse_xlsx(raw, sheet)
    return _tidy(p)
