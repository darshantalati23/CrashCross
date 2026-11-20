/** Thin client for the EDAgent API (FastAPI, see /api). */

export const API_BASE = (import.meta.env.VITE_EDAGENT_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const ctrl = new AbortController();
  const abort = () => ctrl.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  if (init?.signal?.aborted) ctrl.abort();
  const timer = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 90_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      let code = 'error';
      let message = `Request failed (HTTP ${res.status}).`;
      try {
        const body = await res.json();
        code = body?.error?.code ?? code;
        message = body?.error?.message ?? message;
      } catch (e) {
        if (ctrl.signal.aborted) throw e;
      }
      throw new ApiError(res.status, code, message);
    }
    return await res.json() as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, (e as Error).name === 'AbortError' ? 'timeout' : 'network',
      (e as Error).name === 'AbortError' ? 'The EDAgent server took too long to respond.' : 'The EDAgent server could not be reached.');
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
  }
}

export interface Health {
  status: string;
  ai: {
    server_configured: boolean; byok_allowed: boolean; server_providers: string[];
    providers: { id: string; label: string; key_hint: string; server_configured: boolean }[];
  };
  limits: { max_upload_mb: number; max_rows: number; max_columns: number; session_ttl_minutes: number; supported_extensions: string[] };
}

export interface ColumnInfo {
  name: string;
  dtype: string;
  kind: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text' | 'identifier';
  missing: number;
  missing_percent: number;
  unique: number;
  stats?: Record<string, number | string | null>;
  top_values?: { value: unknown; count: number }[];
  sample?: unknown[];
}

export interface Overview {
  rows: number;
  columns: number;
  memory_mb: number;
  duplicate_rows: number;
  complete_rows: number;
  missing_cells: number;
  column_info: ColumnInfo[];
  warnings: { column: string | null; kind: string; severity: 'info' | 'warning'; message: string }[];
  kinds: Record<string, string[]>;
}

export interface Figure {
  data: Plotly.Data[];
  layout: Partial<Plotly.Layout>;
}

export interface ResultBody {
  kind: 'chart' | 'analysis';
  title: string;
  figure?: Figure;
  table?: { columns: string[]; rows: Record<string, unknown>[] };
  facts?: Record<string, unknown>;
  notes?: string[];
  rows_used?: number;
  rows_total?: number;
  operation?: string;
  params?: Record<string, unknown>;
  spec?: Record<string, unknown>;
}

export interface ChartResult extends ResultBody {
  id: string;
  created: string;
}

export interface ChatRecord {
  id?: string;
  kind: 'chat';
  type: 'answer' | 'clarify' | 'decline' | 'error';
  question: string;
  message?: string;
  options?: string[];
  result?: ResultBody;
  explanation?: string;
  explanation_source?: 'ai' | 'template';
  withheld_numbers?: string[];
  provider?: string;
  model?: string;
}

export interface ModelCheck { provider: string; model: string; auto: boolean; models: string[]; failures: { model: string; reason: string }[] }

export interface LlmChoice { provider: string; key?: string; model?: string }

const llmHeaders = (c?: LlmChoice): Record<string, string> => c ? {
  'X-LLM-Provider': c.provider,
  ...(c.key ? { 'X-LLM-Api-Key': c.key } : {}),
  ...(c.model ? { 'X-LLM-Model': c.model } : {}),
} : {};

export type SessionResult = ChartResult | (ChatRecord & { id: string; created: string });

export interface SessionPayload {
  session_id: string;
  filename: string;
  format: string;
  details: Record<string, unknown>;
  notes: string[];
  overview: Overview;
  expires_at: string;
  ttl_minutes: number;
  results: SessionResult[];
}

export const api = {
  health: () => request<Health>('/api/health', { timeoutMs: 95_000 }),
  upload: (file: File, sheet?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (sheet) fd.append('sheet', sheet);
    return request<SessionPayload>('/api/sessions', { method: 'POST', body: fd, timeoutMs: 120_000 });
  },
  session: (sid: string) => request<SessionPayload>(`/api/sessions/${encodeURIComponent(sid)}`),
  remove: (sid: string) => request<{ deleted: boolean }>(`/api/sessions/${encodeURIComponent(sid)}`, { method: 'DELETE' }),
  rows: (sid: string, offset: number, limit: number) =>
    request<{ total: number; columns: string[]; rows: Record<string, unknown>[]; offset: number }>(
      `/api/sessions/${encodeURIComponent(sid)}/rows?offset=${offset}&limit=${limit}`,
    ),
  chart: (sid: string, spec: Record<string, unknown>) =>
    request<ChartResult>(`/api/sessions/${encodeURIComponent(sid)}/charts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(spec),
    }),
  deleteResult: (sid: string, rid: string) =>
    request<{ deleted: boolean }>(`/api/sessions/${encodeURIComponent(sid)}/results/${rid}`, { method: 'DELETE' }),
  models: (c: LlmChoice, signal?: AbortSignal) =>
    request<ModelCheck>('/api/models', { method: 'POST', headers: llmHeaders(c), timeoutMs: 25_000, signal }),
  chat: (sid: string, question: string, llm?: LlmChoice) =>
    request<ChatRecord & { id?: string }>(`/api/sessions/${encodeURIComponent(sid)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...llmHeaders(llm) },
      body: JSON.stringify({ question }),
      timeoutMs: 120_000,
    }),
  exportUrl: (sid: string, kind: 'report.html' | 'results.json' | 'bundle.zip') =>
    `${API_BASE}/api/sessions/${encodeURIComponent(sid)}/export/${kind}`,
};
