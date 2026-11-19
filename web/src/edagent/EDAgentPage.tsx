import { DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileWarning, RefreshCw, Download, Trash2, AlertTriangle, Info, Clock } from 'lucide-react';
import { api, ApiError, Health, SessionPayload } from './api';
import { ChartBuilder } from './ChartBuilder';
import { Chat } from './Chat';
import { Badge, Callout, DataTable, ErrorNote, Segmented, Spinner } from '../components/ui';
import type { Cell, Row } from '../lib/data';

const SESSION_KEY = 'edagent.session';
type Tab = 'overview' | 'quality' | 'rows' | 'charts' | 'chat' | 'export';

function readSid() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function writeSid(v: string | null) {
  try {
    if (v) sessionStorage.setItem(SESSION_KEY, v);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: session lasts for this page view only */
  }
}

const fmt = (v: unknown) =>
  v === null || v === undefined ? '–' : typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumSignificantDigits: 4 })) : String(v);

function UploadPanel({ health, onLoaded }: { health: Health; onLoaded: (s: SessionPayload) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const L = health.limits;
  const accept = L.supported_extensions.join(',');

  const send = async (file: File) => {
    setError(null);
    const ext = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() ?? '';
    if (!L.supported_extensions.includes(ext)) return setError(`“${ext || 'no extension'}” files are not supported. Use ${L.supported_extensions.join(', ')}.`);
    if (file.size > L.max_upload_mb * 1024 * 1024) return setError(`The file is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${L.max_upload_mb} MB.`);
    setBusy(true);
    try {
      onLoaded(await api.upload(file));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) send(f);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`card flex flex-col items-center justify-center gap-3 border-2 border-dashed p-10 text-center ${drag ? 'border-accent bg-accent-soft' : 'border-paper-line'}`}
      >
        <Upload aria-hidden className="h-8 w-8 text-accent" />
        <p className="text-lg font-semibold">Drop a data file here, or choose one</p>
        <p className="max-w-xl text-sm text-ink-soft">
          Supported: <strong>CSV</strong>, <strong>TSV / delimited .txt</strong>, <strong>JSON</strong> (array of records, or an object of columns),
          <strong> JSON Lines</strong> and <strong>Excel .xlsx</strong> (first sheet by default). Up to {L.max_upload_mb} MB,
          {` ${L.max_rows.toLocaleString()}`} rows and {L.max_columns} columns. URLs, databases and other formats are not supported.
        </p>
        <input ref={input} type="file" accept={accept} className="sr-only" id="edagent-file" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
        <label htmlFor="edagent-file" className="btn-primary cursor-pointer">{busy ? 'Uploading and profiling…' : 'Choose file'}</label>
        {busy && <Spinner label="Parsing, profiling and checking quality…" />}
      </div>
      {error && <ErrorNote><FileWarning aria-hidden className="mr-1 inline h-4 w-4" />{error}</ErrorNote>}
      <Callout kind="note" title="Privacy and retention">
        Your parsed data is held only in the EDAgent server’s memory for this session — it is not saved to a database or permanent storage
        (the upload is buffered transiently while it is received), and it is not combined with the crash research data. A session is deleted after {L.session_ttl_minutes} minutes without activity, when you choose “Delete session”, or
        when the server restarts. If AI chat is used, the dataset’s column names, kinds and a few example values, plus small computed result
        tables, are sent to the AI provider; raw rows are not sent.
      </Callout>
    </div>
  );
}

function OverviewTab({ s }: { s: SessionPayload }) {
  const o = s.overview;
  const tiles: [string, string][] = [
    ['Rows', o.rows.toLocaleString()], ['Columns', String(o.columns)], ['Duplicate rows', o.duplicate_rows.toLocaleString()],
    ['Complete rows', `${o.complete_rows.toLocaleString()} (${((100 * o.complete_rows) / o.rows).toFixed(1)}%)`],
    ['Missing cells', o.missing_cells.toLocaleString()], ['In memory', `${o.memory_mb} MB`],
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([k, v]) => (
          <div key={k} className="card p-3"><p className="text-xs text-ink-faint">{k}</p><p className="text-lg font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>
      {s.notes.length > 0 && <ul className="list-disc pl-5 text-sm text-ink-soft">{s.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      <DataTable rows={o.column_info as unknown as Row[]} maxHeight={520} columns={[
        { key: 'name', label: 'Column', format: (v) => <span className="font-medium">{String(v)}</span> },
        { key: 'kind', label: 'Kind', format: (v) => <Badge>{String(v)}</Badge> },
        { key: 'dtype', label: 'Storage' },
        { key: 'missing_percent', label: 'Missing %', align: 'right', format: (v) => Number(v).toFixed(1) },
        { key: 'unique', label: 'Distinct', align: 'right', format: (v) => fmt(v) },
        { key: 'stats', label: 'Summary', format: (_v: Cell, r: Row) => {
          const c = r as unknown as SessionPayload['overview']['column_info'][number];
          if (c.kind === 'numeric' && c.stats) return `mean ${fmt(c.stats.mean)} · median ${fmt(c.stats.median)} · min ${fmt(c.stats.min)} · max ${fmt(c.stats.max)}`;
          if (c.kind === 'datetime' && c.stats) return `${String(c.stats.min ?? '').slice(0, 10)} → ${String(c.stats.max ?? '').slice(0, 10)}`;
          if (c.top_values?.length) return 'top: ' + c.top_values.slice(0, 3).map((t) => `${String(t.value)} (${t.count.toLocaleString()})`).join(', ');
          return (c.sample ?? []).slice(0, 2).map(String).join(', ');
        } },
      ]} footnote="Kinds are inferred automatically (numeric, categorical, datetime, boolean, free text, identifier) and decide which charts and statistics are offered." />
    </div>
  );
}

function QualityTab({ s }: { s: SessionPayload }) {
  const w = s.overview.warnings;
  const missing = [...s.overview.column_info].filter((c) => c.missing > 0).sort((a, b) => b.missing - a.missing);
  return (
    <div className="space-y-5">
      {w.length === 0 ? <p className="text-sm">No issues were flagged by the automatic checks.</p> : (
        <ul className="space-y-2">
          {w.map((x, i) => (
            <li key={i} className={`flex gap-2 rounded-md border px-3 py-2 text-sm ${x.severity === 'warning' ? 'border-warn/40 bg-warn-soft' : 'border-paper-line bg-white'}`}>
              {x.severity === 'warning' ? <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warn" /> : <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
              <span><strong>{x.column ?? 'Dataset'}</strong> — {x.message}</span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <h3 className="mb-2 font-semibold">Missing values by column</h3>
        {missing.length === 0 ? <p className="text-sm text-ink-soft">No missing values.</p> : (
          <DataTable rows={missing as unknown as Row[]} maxHeight={360} columns={[
            { key: 'name', label: 'Column' },
            { key: 'missing', label: 'Missing', align: 'right', format: (v) => fmt(v) },
            { key: 'missing_percent', label: 'Missing %', align: 'right', format: (v) => Number(v).toFixed(2) },
          ]} />
        )}
      </div>
      <p className="text-xs text-ink-faint">Checks: duplicates, missingness (&gt; 20% / &gt; 50%), constant columns, likely identifiers, mixed numeric/text values, high cardinality and IQR outliers. Flags are prompts for review, not automatic corrections — nothing is changed in your data.</p>
    </div>
  );
}

function RowsTab({ s }: { s: SessionPayload }) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; columns: string[]; rows: Record<string, unknown>[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const limit = 50;
  useEffect(() => {
    setErr(null);
    api.rows(s.session_id, offset, limit).then(setData).catch((e: ApiError) => setErr(e.message));
  }, [s.session_id, offset]);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!data) return <Spinner />;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <button className="btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button>
        <span>Rows {offset + 1}–{Math.min(offset + limit, data.total)} of {data.total.toLocaleString()}</span>
        <button className="btn-secondary" disabled={offset + limit >= data.total} onClick={() => setOffset(offset + limit)}>Next</button>
      </div>
      <DataTable rows={data.rows as Row[]} maxHeight={560} columns={data.columns.map((c) => ({ key: c, label: c, format: (v: Cell) => fmt(v) }))} />
    </div>
  );
}

function ExportTab({ s, onDelete }: { s: SessionPayload; onDelete: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const download = async (kind: 'report.html' | 'results.json' | 'bundle.zip') => {
    setBusy(kind);
    setErr(null);
    try {
      const res = await fetch(api.exportUrl(s.session_id, kind));
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error?.message ?? `Export failed (HTTP ${res.status}).`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edagent_${s.filename.replace(/\.[^.]+$/, '')}_${kind}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const charts = s.results.filter((r) => r.kind === 'chart').length;
  const chats = s.results.filter((r) => r.kind === 'chat').length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Exports are generated from this session’s actual results: the dataset overview and quality checks, {charts} chart(s) and {chats} chat answer(s).
        AI-written text is labelled separately from computed values.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {([
          ['report.html', 'HTML report', 'Readable report with overview, quality checks, every chart (interactive when online) and its table.'],
          ['bundle.zip', 'ZIP bundle', 'The HTML report, results JSON, the column profile and every result table as CSV.'],
          ['results.json', 'Results JSON', 'Machine-readable overview, chart specifications, tables and chat answers.'],
        ] as const).map(([k, title, d]) => (
          <div key={k} className="card flex flex-col p-4">
            <p className="font-semibold">{title}</p>
            <p className="mt-1 flex-1 text-sm text-ink-soft">{d}</p>
            <button type="button" className="btn-primary mt-3 self-start" disabled={!!busy} onClick={() => download(k)}>
              <Download aria-hidden className="h-4 w-4" /> {busy === k ? 'Preparing…' : `Download ${k.split('.').pop()?.toUpperCase()}`}
            </button>
          </div>
        ))}
      </div>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="border-t border-paper-line pt-4">
        <button type="button" className="btn-secondary text-warn" onClick={onDelete}><Trash2 aria-hidden className="h-4 w-4" /> Delete session now</button>
        <p className="mt-1 text-xs text-ink-faint">Removes the uploaded data and all results from the server immediately.</p>
      </div>
    </div>
  );
}

export function EDAgentPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [expired, setExpired] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  const check = useCallback(() => {
    setHealthErr(null);
    setHealth(null);
    api.health().then(setHealth).catch((e: ApiError) => setHealthErr(e.message));
  }, []);
  useEffect(check, [check]);

  useEffect(() => {
    const sid = readSid();
    if (!health || !sid || session) return;
    setRestoring(true);
    api.session(sid)
      .then(setSession)
      .catch((e: ApiError) => {
        if (e.status === 404) setExpired(true);
        writeSid(null);
      })
      .finally(() => setRestoring(false));
  }, [health, session]);

  const loaded = (s: SessionPayload) => {
    writeSid(s.session_id);
    setExpired(false);
    setSession(s);
    setTab('overview');
  };
  const onResults = (results: SessionPayload['results']) => session && setSession({ ...session, results });
  const close = async (remove: boolean) => {
    if (session && remove) await api.remove(session.session_id).catch(() => undefined);
    writeSid(null);
    setSession(null);
  };

  // Any API call returning session_not_found while working → expired state.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      api.session(session.session_id).catch((e: ApiError) => {
        if (e.status === 404) {
          writeSid(null);
          setSession(null);
          setExpired(true);
        }
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [session]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Additional tool · separate from the research</p>
        <h1 className="font-serif text-3xl font-semibold sm:text-4xl">EDAgent</h1>
        <p className="mt-2 max-w-3xl text-ink-soft">
          A general-purpose exploratory-analysis assistant for <em>your own</em> dataset: import a file, review its structure and quality,
          build charts, optionally ask grounded questions, and export a report. It does not use or change the Allegheny County crash results
          shown elsewhere on this site.
        </p>
      </header>

      {healthErr ? (
        <div className="space-y-3">
          <ErrorNote>
            {healthErr} The EDAgent server may be starting up (free hosting can take about a minute to wake) or may not be deployed for this site.
          </ErrorNote>
          <button type="button" className="btn-secondary" onClick={check}><RefreshCw aria-hidden className="h-4 w-4" /> Try again</button>
          <p className="text-sm text-ink-faint">The research chapters, report and resources do not depend on this server.</p>
        </div>
      ) : !health ? (
        <Spinner label="Connecting to the EDAgent server (this can take up to a minute if it was asleep)…" />
      ) : restoring ? (
        <Spinner label="Restoring your session…" />
      ) : !session ? (
        <div className="space-y-4">
          {expired && (
            <Callout kind="caution" title="Your previous session has expired">
              Sessions are kept for {health.limits.session_ttl_minutes} minutes without activity and are cleared when the server restarts. Upload the
              file again to continue; earlier charts and answers are no longer available unless you exported them.
            </Callout>
          )}
          <UploadPanel health={health} onLoaded={loaded} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{session.filename}</p>
              <p className="text-sm text-ink-soft">
                {session.format} · {session.overview.rows.toLocaleString()} rows × {session.overview.columns} columns
                {session.details?.sheet ? ` · sheet “${String(session.details.sheet)}”` : ''}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint"><Clock aria-hidden className="h-3 w-3" /> Expires after {session.ttl_minutes} minutes of inactivity.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => close(false)}>Upload another file</button>
              <button type="button" className="btn-secondary" onClick={() => close(true)}><Trash2 aria-hidden className="h-4 w-4" /> Delete session</button>
            </div>
          </div>
          <Segmented<Tab> label="EDAgent sections" value={tab} onChange={setTab} options={[
            { value: 'overview', label: 'Overview' }, { value: 'quality', label: `Quality (${session.overview.warnings.length})` },
            { value: 'rows', label: 'Rows' }, { value: 'charts', label: 'Visualise' }, { value: 'chat', label: 'Chat' }, { value: 'export', label: 'Export' },
          ]} />
          {tab === 'overview' && <OverviewTab s={session} />}
          {tab === 'quality' && <QualityTab s={session} />}
          {tab === 'rows' && <RowsTab s={session} />}
          {tab === 'charts' && <ChartBuilder session={session} onResultsChange={onResults} />}
          {tab === 'chat' && <Chat session={session} health={health} onResultsChange={onResults} />}
          {tab === 'export' && <ExportTab s={session} onDelete={() => close(true)} />}
        </div>
      )}
    </div>
  );
}
