import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Send, KeyRound, ShieldCheck, Bot } from 'lucide-react';
import { api, ApiError, ChatRecord, Health, ModelCheck, SessionPayload } from './api';
import { ResultView } from './ResultView';
import { Badge, Callout, Disclosure, ErrorNote } from '../components/ui';

// Text models with a published free tier; project access and quotas still apply.
// Checked 2026-11-20: https://ai.google.dev/gemini-api/docs/pricing
const GEMINI_PRESETS = [
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (default)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (preview)' },
];
const defaultModel = (provider: string) => provider === 'gemini' ? GEMINI_PRESETS[0].id : 'auto';

export function Chat({ session, health, onResultsChange }: {
  session: SessionPayload; health: Health; onResultsChange: (r: SessionPayload['results']) => void;
}) {
  const saved = session.results.filter((r) => r.kind === 'chat') as (ChatRecord & { id: string; created: string })[];
  const [transient, setTransient] = useState<ChatRecord[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byok, setByok] = useState(''); // held in memory only; never persisted
  const providers = health.ai.providers;
  const usable = providers.filter((p) => p.server_configured || health.ai.byok_allowed);
  const [provider, setProvider] = useState((usable.find((p) => p.id === 'gemini' && p.server_configured) ?? usable.find((p) => p.server_configured) ?? usable[0])?.id ?? 'anthropic');
  const [model, setModel] = useState(() => defaultModel(provider));
  const [discovered, setDiscovered] = useState<string[]>([]);
  const [check, setCheck] = useState<ModelCheck | null>(null); // last successful discovery/validation
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const checkRequest = useRef<AbortController | null>(null);
  useEffect(() => () => checkRequest.current?.abort(), []);
  const cancelCheck = () => {
    checkRequest.current?.abort();
    checkRequest.current = null;
    setChecking(false);
  };
  const cur = providers.find((p) => p.id === provider);
  // A key is only sent for the provider the user selected; a server-managed key needs none.
  const useKey = health.ai.byok_allowed && byok.trim().length > 0;
  const aiOn = !!cur && (useKey || cur.server_configured) && !checking;
  const llm = () => ({ provider, key: useKey ? byok.trim() : undefined, model: check && check.provider === provider ? check.model : model });

  const verify = async (m: string) => {
    cancelCheck();
    const controller = new AbortController();
    checkRequest.current = controller;
    setChecking(true);
    setCheckError(null);
    setCheck(null);
    try {
      const c = await api.models({ provider, key: useKey ? byok.trim() : undefined, model: m }, controller.signal);
      if (checkRequest.current !== controller) return;
      setDiscovered(c.models);
      setCheck(c);
    } catch (e) {
      if (checkRequest.current === controller) setCheckError((e as ApiError).message);
    } finally {
      if (checkRequest.current === controller) { checkRequest.current = null; setChecking(false); }
    }
  };
  // Changing provider or key invalidates the earlier check and the model choice.
  const resetCheck = (nextProvider = provider) => {
    cancelCheck(); setCheck(null); setCheckError(null); setDiscovered([]); setModel(defaultModel(nextProvider));
  };
  const presets = provider === 'gemini' ? GEMINI_PRESETS : [];

  const ov = session.overview;
  const suggestions = useMemo(() => {
    const num = ov.kinds.numeric ?? [];
    const cat = (ov.column_info.filter((c) => c.kind === 'categorical' && c.unique <= 30)).map((c) => c.name);
    const s = ['Which columns have the most missing values?'];
    if (num[0]) s.push(`Summarise ${num[0]}`);
    if (num[0] && cat[0]) s.push(`Average ${num[0]} by ${cat[0]}`);
    if (num.length >= 2) s.push('Which numeric columns are most strongly correlated?');
    if (cat[0]) s.push(`Show a bar chart of ${cat[0]}`);
    return s.slice(0, 4);
  }, [ov]);

  const thread = useMemo(() => {
    const all = [...saved.map((r) => ({ ...r, t: r.created })), ...transient.map((r, i) => ({ ...r, t: (r as { _t?: string })._t ?? String(i) }))];
    return all.sort((a, b) => String(a.t).localeCompare(String(b.t)));
  }, [saved, transient]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.chat(session.session_id, question.trim(), llm());
      if (res.type === 'answer' && res.id) onResultsChange([...session.results, res as ChatRecord & { id: string; created: string }]);
      else setTransient((t) => [...t, { ...res, _t: new Date().toISOString() } as ChatRecord]);
      setQ('');
      setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 50);
    } catch (e) {
      const err = e as ApiError;
      setError(err.code === 'ai_auth' && useKey ? 'The API key you entered was rejected by the provider.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(q);
  };

  if (!health.ai.server_configured && !health.ai.byok_allowed) {
    return (
      <Callout kind="note" title="Chat is optional and not configured on this server">
        <p>
          The EDAgent server has no AI provider key, so dataset chat is turned off. Everything else — overview, quality checks, charts and
          exports — works without it. Operators can enable chat by setting a provider key (<code>ANTHROPIC_API_KEY</code>, <code>GEMINI_API_KEY</code> or <code>XAI_API_KEY</code>) on the backend (see the
          deployment guide).
        </p>
      </Callout>
    );
  }

  return (
    <div className="space-y-4">
      <Callout kind="note" title="How chat answers are produced">
        <p>
          The AI only chooses one approved analysis (such as a summary, a grouped aggregate, a correlation or a chart) on <strong>your uploaded
          dataset</strong>. Lookups search all uploaded rows and return a server-written answer. Other results may have an AI explanation whose
          numbers are checked against computed values; this check does not verify every written claim. Partial results are labelled.
          Use the Rows tab to search without an AI call. Unsupported or ambiguous questions need clarification; no generated code is run.
        </p>
      </Callout>

      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="llm-provider" className="block text-sm font-semibold">Provider</label>
            <select id="llm-provider" className="input mt-1" value={provider} disabled={busy} onChange={(e) => { setProvider(e.target.value); resetCheck(e.target.value); }}>
              {usable.map((p) => <option key={p.id} value={p.id}>{p.label}{p.server_configured ? ' (server key)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="llm-model" className="block text-sm font-semibold">Model</label>
            <select id="llm-model" className="input mt-1" value={model} disabled={busy}
              onChange={(e) => { cancelCheck(); setModel(e.target.value); setCheck(null); setCheckError(null); }}>
              {presets.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              <option value="auto">Auto</option>
              {discovered.filter((m) => !presets.some((p) => p.id === m)).map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button type="button" className="btn-secondary" disabled={busy || checking || !cur || !(useKey || cur.server_configured)} onClick={() => verify(model)}>
            {checking ? 'Checking…' : 'Check key & model'}
          </button>
          {checking && <button type="button" className="btn-secondary" onClick={cancelCheck}>Cancel check</button>}
        </div>
        {provider === 'gemini' && <p className="text-xs text-ink-soft">Presets have a published free tier; project quotas and billing settings apply. You can chat without checking first. Checks stop within 25 seconds.</p>}
        {health.ai.byok_allowed && (
          <div>
            <label htmlFor="byok" className="flex items-center gap-2 text-sm font-semibold"><KeyRound aria-hidden className="h-4 w-4" /> API key{cur?.server_configured ? ' (optional — this server has one)' : ''}</label>
            <input id="byok" type="password" autoComplete="off" spellCheck={false} className="input mt-1 w-full max-w-md" placeholder={cur?.key_hint}
              value={byok} onChange={(e) => { setByok(e.target.value); resetCheck(); }} />
            <p className="mt-1 text-xs text-ink-soft">
              Kept in this tab’s memory only, sent over HTTPS to this server with each request and forwarded only to the provider selected above
              (never guessed from the key). Never saved or logged. Usage is billed to your account.
            </p>
          </div>
        )}
        {check && (
          <p className="text-sm" role="status">
            <Badge tone="ok">Ready</Badge> {check.model}{check.auto ? ' (chosen by Auto)' : ''} — model check passed.
            {check.failures.length > 0 && <span className="text-ink-soft"> Skipped: {check.failures.map((f) => `${f.model} (${f.reason})`).join('; ')}</span>}
          </p>
        )}
        {checkError && <ErrorNote>{checkError}</ErrorNote>}
      </div>

      <div className="space-y-4" aria-live="polite">
        {thread.length === 0 && (
          <p className="text-sm text-ink-soft">Ask a question about <strong>{session.filename}</strong>. Try one of the suggestions below.</p>
        )}
        {thread.map((m, i) => (
          <div key={(m as { id?: string }).id ?? i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-accent px-3 py-2 text-sm text-white">{m.question}</p>
            <div className="card max-w-full p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <Bot aria-hidden className="h-4 w-4" />
                {m.type === 'answer' && (m.explanation_source === 'ai'
                  ? <Badge tone="ok"><ShieldCheck aria-hidden className="mr-1 h-3 w-3" />AI explanation · numbers checked</Badge>
                  : <Badge tone="neutral">Summary from computed values</Badge>)}
                {m.type === 'clarify' && <Badge tone="accent">Needs clarification</Badge>}
                {m.type === 'decline' && <Badge tone="warn">Not answered</Badge>}
                {m.type === 'error' && <Badge tone="warn">Could not interpret</Badge>}
              </p>
              {m.type === 'answer' ? (
                <>
                  <p className="leading-relaxed">{m.explanation}</p>
                  {m.withheld_numbers && m.withheld_numbers.length > 0 && (
                    <p className="mt-1 text-xs text-ink-faint">An AI-written explanation was withheld because it contained numbers not present in the result ({m.withheld_numbers.join(', ')}).</p>
                  )}
                  {m.result && (
                    <div className="mt-3">
                      <ResultView result={m.result} compact />
                      <Disclosure summary="What was computed" className="mt-2">
                        <code className="break-all text-xs">{m.result.operation}({JSON.stringify(m.result.params)})</code>
                      </Disclosure>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p>{m.message}</p>
                  {m.options && m.options.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.options.map((o) => <button key={o} type="button" className="btn-secondary" disabled={busy || !aiOn} onClick={() => ask(`${m.question} — ${o}`)}>{o}</button>)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => <button key={s} type="button" className="btn-secondary text-xs" disabled={busy || !aiOn} onClick={() => ask(s)}>{s}</button>)}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="chat-q" className="sr-only">Question about your dataset</label>
        <input id="chat-q" className="input flex-1" maxLength={1000} placeholder={aiOn ? 'Ask about this dataset…' : 'Choose a provider and add a key above to enable chat'}
          value={q} onChange={(e) => setQ(e.target.value)} disabled={!aiOn || busy} />
        <button type="submit" className="btn-primary" disabled={!aiOn || busy || !q.trim()}>
          <Send aria-hidden className="h-4 w-4" /> {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
