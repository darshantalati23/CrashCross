import { useEffect, useState } from 'react';

/** Base path for the static research bundle produced by scripts/build_site_data.py. */
export const DATA_BASE = '/data';

export type Cell = string | number | null;
export type Row = Record<string, Cell>;

const cache = new Map<string, Promise<unknown>>();

/** Minimal RFC-4180 CSV parser (quoted fields, embedded commas/quotes/newlines). */
export function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  if (!header) return [];
  return body.map((r) => {
    const o: Row = {};
    header.forEach((h, j) => {
      const v = r[j] ?? '';
      // CSV empty cell = missing (export convention); never coerced to zero.
      if (v === '') o[h] = null;
      else if (/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(v)) o[h] = Number(v);
      else if (v === 'inf') o[h] = Infinity;
      else o[h] = v;
    });
    return o;
  });
}

function fetchText(url: string): Promise<string> {
  return fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${url}`);
    // An SPA fallback can answer a missing data file with index.html; never parse that as data.
    if ((r.headers.get('content-type') ?? '').includes('text/html')) throw new Error(`Data file not found — ${url}`);
    return r.text();
  });
}

export function loadCsv(path: string): Promise<Row[]> {
  const url = `${DATA_BASE}/${path}`;
  if (!cache.has(url)) cache.set(url, fetchText(url).then(parseCsv));
  return cache.get(url) as Promise<Row[]>;
}

export function loadJson<T = unknown>(path: string): Promise<T> {
  const url = `${DATA_BASE}/${path}`;
  if (!cache.has(url)) cache.set(url, fetchText(url).then((t) => JSON.parse(t)));
  return cache.get(url) as Promise<T>;
}

export interface Loaded<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

function useLoader<T>(key: string, fn: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setState({ data: null, error: null, loading: true });
    fn()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: Error) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

/** Load several CSVs at once; returns a map keyed by the given names. */
export function useCsvs(paths: Record<string, string>): Loaded<Record<string, Row[]>> {
  const key = JSON.stringify(paths);
  return useLoader(key, async () => {
    const entries = await Promise.all(
      Object.entries(paths).map(async ([k, p]) => [k, await loadCsv(p)] as const),
    );
    return Object.fromEntries(entries);
  });
}

export function useJson<T>(path: string): Loaded<T> {
  return useLoader(path, () => loadJson<T>(path));
}

// ---------- formatting -------------------------------------------------------------
export const fmtInt = (v: Cell) =>
  v === null || v === undefined || v === '' ? '–' : Math.round(Number(v)).toLocaleString('en-US');
export const fmtFixed = (v: Cell, d: number) =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '–' : Number(v).toFixed(d);
export const fmtPct = (v: Cell, d = 2) => (v === null ? '–' : `${fmtFixed(v, d)}%`);
export function fmtQ(q: Cell): string {
  if (q === null) return '–';
  const n = Number(q);
  return n < 0.001 ? '< 0.001' : n.toFixed(3);
}

export function toCsv(rows: Row[], columns?: string[]): string {
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
