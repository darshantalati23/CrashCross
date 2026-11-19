import { FormEvent, useMemo, useRef, useState } from 'react';
import { Send, KeyRound, ShieldCheck, Bot } from 'lucide-react';
import { api, ApiError, ChatRecord, Health, SessionPayload } from './api';
import { ResultView } from './ResultView';
import { Badge, Callout, Disclosure, ErrorNote } from '../components/ui';

export function Chat({ session, health, onResultsChange }: {
  session: SessionPayload; health: Health; onResultsChange: (r: SessionPayload['results']) => void;
}) {
  const saved = session.results.filter((r) => r.kind === 'chat') as (ChatRecord & { id: string; created: string })[];
  const [transient, setTransient] = useState<ChatRecord[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byok, setByok] = useState(''); // held in memory only; never persisted
  const endRef = useRef<HTMLDivElement>(null);
  const aiOn = health.ai.server_configured || (health.ai.byok_allowed && byok.trim().length > 0);

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
      const res = await api.chat(session.session_id, question.trim(), health.ai.byok_allowed ? byok.trim() || undefined : undefined);
      if (res.type === 'answer' && res.id) onResultsChange([...session.results, res as ChatRecord & { id: string; created: string }]);
      else setTransient((t) => [...t, { ...res, _t: new Date().toISOString() } as ChatRecord]);
      setQ('');
      setTimeout(() => endRef.current?.scrollIntoView({ block: 'end' }), 50);
    } catch (e) {
      const err = e as ApiError;
      setError(err.code === 'ai_auth' && byok ? 'The API key you entered was rejected by the provider.' : err.message);
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
          exports — works without it. Operators can enable chat by setting <code>ANTHROPIC_API_KEY</code> on the backend (see the
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
          dataset</strong>. The server computes every number; the AI then explains the result, and its explanation is shown only if every number
          in it matches the computed values. It declines questions unrelated to this dataset and never runs code. Answers are labelled.
        </p>
      </Callout>

      {!health.ai.server_configured && health.ai.byok_allowed && (
        <div className="card p-4">
          <label htmlFor="byok" className="flex items-center gap-2 font-semibold"><KeyRound aria-hidden className="h-4 w-4" /> Your Anthropic API key</label>
          <p className="mt-1 text-sm text-ink-soft">
            This server has no shared AI key but accepts your own. The key stays in this browser tab’s memory (not stored), is sent over HTTPS
            with each chat request only, is used for that request and is never saved or logged by the server. Usage is billed to your account.
          </p>
          <input id="byok" type="password" autoComplete="off" spellCheck={false} className="input mt-2 w-full max-w-md" placeholder="sk-ant-…"
            value={byok} onChange={(e) => setByok(e.target.value)} />
        </div>
      )}

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
                  ? <Badge tone="ok"><ShieldCheck aria-hidden className="mr-1 h-3 w-3" />AI explanation · numbers verified</Badge>
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
        <input id="chat-q" className="input flex-1" maxLength={1000} placeholder={aiOn ? 'Ask about this dataset…' : 'Enter your API key above to enable chat'}
          value={q} onChange={(e) => setQ(e.target.value)} disabled={!aiOn || busy} />
        <button type="submit" className="btn-primary" disabled={!aiOn || busy || !q.trim()}>
          <Send aria-hidden className="h-4 w-4" /> {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
