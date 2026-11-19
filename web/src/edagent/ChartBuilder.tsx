import { useEffect, useMemo, useState } from 'react';
import { BarChart3, LineChart, ScatterChart, Grid3x3, BoxSelect, Columns3, Trash2 } from 'lucide-react';
import { api, ApiError, ChartResult, ColumnInfo, SessionPayload } from './api';
import { ResultView } from './ResultView';
import { ErrorNote, Spinner } from '../components/ui';

type ChartType = 'bar' | 'histogram' | 'line' | 'scatter' | 'box' | 'heatmap';
type Kind = ColumnInfo['kind'];

const TYPES: { id: ChartType; label: string; icon: typeof BarChart3; help: string }[] = [
  { id: 'bar', label: 'Bar', icon: BarChart3, help: 'Counts or an aggregate of a number per category.' },
  { id: 'histogram', label: 'Histogram', icon: Columns3, help: 'Distribution of one numeric column.' },
  { id: 'line', label: 'Line', icon: LineChart, help: 'A count or aggregate over dates or an ordered number.' },
  { id: 'scatter', label: 'Scatter', icon: ScatterChart, help: 'Relationship between two numeric columns.' },
  { id: 'box', label: 'Box plot', icon: BoxSelect, help: 'Spread of a numeric column, optionally by group.' },
  { id: 'heatmap', label: 'Correlation', icon: Grid3x3, help: 'Correlation matrix of 2–15 numeric columns.' },
];

interface Rule {
  x?: { kinds: Kind[]; required: boolean; maxUnique?: number; numericMaxUnique?: number; label: string };
  y?: { kinds: Kind[]; required: boolean; label: string };
  color?: boolean;
  agg?: boolean;
  bins?: boolean;
  topN?: boolean;
  interval?: boolean;
  columns?: boolean;
}

const RULES: Record<ChartType, Rule> = {
  bar: { x: { kinds: ['categorical', 'boolean', 'numeric'], required: true, numericMaxUnique: 30, label: 'Category (X)' }, y: { kinds: ['numeric'], required: false, label: 'Value (Y, optional)' }, color: true, agg: true, topN: true },
  histogram: { x: { kinds: ['numeric'], required: true, label: 'Numeric column' }, color: true, bins: true },
  line: { x: { kinds: ['datetime', 'numeric'], required: true, label: 'Date or number (X)' }, y: { kinds: ['numeric'], required: false, label: 'Value (Y, optional)' }, color: true, agg: true, interval: true },
  scatter: { x: { kinds: ['numeric'], required: true, label: 'X' }, y: { kinds: ['numeric'], required: true, label: 'Y' }, color: true },
  box: { y: { kinds: ['numeric'], required: true, label: 'Numeric column' }, x: { kinds: ['categorical', 'boolean'], required: false, maxUnique: 20, label: 'Group by (optional)' } },
  heatmap: { columns: true },
};

function usable(c: ColumnInfo, kinds: Kind[], maxUnique?: number, numericMaxUnique?: number): string | null {
  if (!kinds.includes(c.kind)) return `${c.kind}`;
  if (maxUnique && c.unique > maxUnique) return `${c.unique} categories > ${maxUnique}`;
  if (numericMaxUnique && c.kind === 'numeric' && c.unique > numericMaxUnique) return `numeric, ${c.unique.toLocaleString()} distinct values`;
  return null;
}

function ColumnSelect({ label, value, onChange, cols, kinds, required, maxUnique, numericMaxUnique, id }: {
  label: string; value: string; onChange: (v: string) => void; cols: ColumnInfo[]; kinds: Kind[]; required: boolean; maxUnique?: number; numericMaxUnique?: number; id: string;
}) {
  return (
    <label htmlFor={id} className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {!required && <option value="">— none —</option>}
        {required && !value && <option value="">Choose a column…</option>}
        {cols.map((c) => {
          const why = usable(c, kinds, maxUnique, numericMaxUnique);
          return (
            <option key={c.name} value={c.name} disabled={!!why}>
              {c.name} {why ? `(not usable: ${why})` : `· ${c.kind}`}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function ChartBuilder({ session, onResultsChange }: { session: SessionPayload; onResultsChange: (r: SessionPayload['results']) => void }) {
  const cols = session.overview.column_info;
  const [type, setType] = useState<ChartType>('bar');
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [color, setColor] = useState('');
  const [agg, setAgg] = useState('count');
  const [bins, setBins] = useState(30);
  const [topN, setTopN] = useState(20);
  const [interval, setIntervalV] = useState('auto');
  const [method, setMethod] = useState('pearson');
  const [columns, setColumns] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rule = RULES[type];
  const charts = session.results.filter((r): r is ChartResult => r.kind === 'chart');

  // Sensible defaults whenever the chart type changes.
  useEffect(() => {
    const first = (kinds: Kind[], maxU?: number, numMax?: number) => cols.find((c) => !usable(c, kinds, maxU, numMax))?.name ?? '';
    setError(null);
    setX(rule.x?.required ? first(rule.x.kinds, rule.x.maxUnique, rule.x.numericMaxUnique) : '');
    setY(rule.y?.required ? first(rule.y.kinds) : '');
    setColor('');
    setAgg('count');
    if (type === 'scatter' && rule.y) {
      const nums = cols.filter((c) => c.kind === 'numeric');
      setX(nums[0]?.name ?? '');
      setY(nums[1]?.name ?? '');
    }
    if (type === 'line') setX(cols.find((c) => c.kind === 'datetime')?.name ?? first(['numeric']));
    if (type === 'heatmap') setColumns(cols.filter((c) => c.kind === 'numeric').slice(0, 8).map((c) => c.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, session.session_id]);

  useEffect(() => {
    if (!y && agg !== 'count') setAgg('count');
    if (y && agg === 'count') setAgg('mean');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y]);

  const problems = useMemo(() => {
    const p: string[] = [];
    if (rule.x?.required && !x) p.push(`Choose ${rule.x.label.toLowerCase()}.`);
    if (rule.y?.required && !y) p.push(`Choose ${rule.y.label.toLowerCase()}.`);
    if ((type === 'scatter' || type === 'line' || type === 'bar') && x && x === y) p.push('X and Y should be different columns.');
    if (type === 'heatmap' && (columns.length < 2 || columns.length > 15)) p.push('Select between 2 and 15 numeric columns.');
    if (rule.x && !rule.x.kinds.length) p.push('No suitable columns.');
    return p;
  }, [rule, x, y, type, columns]);

  const colorCols = cols.filter((c) => !usable(c, ['categorical', 'boolean'], 8));
  const numericCols = cols.filter((c) => c.kind === 'numeric');
  const xKind = cols.find((c) => c.name === x)?.kind;

  const create = async () => {
    setBusy(true);
    setError(null);
    const spec: Record<string, unknown> = { chart_type: type };
    if (type === 'heatmap') Object.assign(spec, { columns, method });
    else {
      Object.assign(spec, { x: x || null, y: y || null, color: color || null });
      if (rule.agg) spec.agg = agg;
      if (rule.bins) spec.bins = bins;
      if (rule.topN) spec.top_n = topN;
      if (rule.interval && xKind === 'datetime') spec.interval = interval;
    }
    try {
      const res = await api.chart(session.session_id, spec);
      onResultsChange([...session.results, res]);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteResult(session.session_id, id);
    } catch {
      /* removal failure leaves it on the server; local list still updates */
    }
    onResultsChange(session.results.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <h3 className="font-semibold">Chart type</h3>
        <div role="radiogroup" aria-label="Chart type" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {TYPES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={type === t.id} onClick={() => setType(t.id)}
              className={`rounded-md border p-2.5 text-left text-sm ${type === t.id ? 'border-accent bg-accent-soft' : 'border-paper-line bg-white hover:bg-paper'}`}>
              <t.icon aria-hidden className="h-5 w-5 text-accent" />
              <span className="mt-1 block font-semibold">{t.label}</span>
              <span className="block text-xs text-ink-soft">{t.help}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {type === 'heatmap' ? (
            <fieldset className="flex-1">
              <legend className="text-sm font-medium">Numeric columns ({columns.length} selected)</legend>
              {numericCols.length < 2 ? (
                <p className="mt-1 text-sm text-warn">This dataset has fewer than two numeric columns, so a correlation matrix is not possible.</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2">
                  {numericCols.map((c) => (
                    <label key={c.name} className="flex items-center gap-1.5 rounded border border-paper-line bg-white px-2 py-1 text-sm">
                      <input type="checkbox" checked={columns.includes(c.name)}
                        onChange={(e) => setColumns((s) => (e.target.checked ? [...s, c.name] : s.filter((n) => n !== c.name)))} />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
              <label className="mt-3 flex items-center gap-2 text-sm">Method
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="pearson">Pearson (linear)</option>
                  <option value="spearman">Spearman (rank)</option>
                </select>
              </label>
            </fieldset>
          ) : (
            <>
              {type === 'box' ? (
                <>
                  <ColumnSelect id="cb-y" label={rule.y!.label} value={y} onChange={setY} cols={cols} kinds={rule.y!.kinds} required />
                  <ColumnSelect id="cb-x" label={rule.x!.label} value={x} onChange={setX} cols={cols} kinds={rule.x!.kinds} required={false} maxUnique={20} />
                </>
              ) : (
                <>
                  {rule.x && <ColumnSelect id="cb-x" label={rule.x.label} value={x} onChange={setX} cols={cols} kinds={rule.x.kinds} required={rule.x.required} numericMaxUnique={rule.x.numericMaxUnique} />}
                  {rule.y && <ColumnSelect id="cb-y" label={rule.y.label} value={y} onChange={setY} cols={cols} kinds={rule.y.kinds} required={rule.y.required} />}
                </>
              )}
              {rule.agg && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Aggregation</span>
                  <select className="input" value={agg} onChange={(e) => setAgg(e.target.value)}>
                    <option value="count">Count of rows</option>
                    {['sum', 'mean', 'median', 'min', 'max'].map((a) => <option key={a} value={a} disabled={!y}>{a}{!y ? ' (needs Y)' : ''}</option>)}
                  </select>
                </label>
              )}
              {rule.color && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Colour by (optional)</span>
                  <select className="input" value={color} onChange={(e) => setColor(e.target.value)}>
                    <option value="">— none —</option>
                    {colorCols.map((c) => <option key={c.name} value={c.name}>{c.name} · {c.unique} groups</option>)}
                  </select>
                  {colorCols.length === 0 && <span className="text-xs text-ink-faint">No categorical column with ≤ 8 groups.</span>}
                </label>
              )}
              {rule.bins && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Bins: {bins}</span>
                  <input type="range" min={5} max={100} value={bins} onChange={(e) => setBins(Number(e.target.value))} />
                </label>
              )}
              {rule.topN && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Show top</span>
                  <input className="input w-24" type="number" min={1} max={100} value={topN} onChange={(e) => setTopN(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
                </label>
              )}
              {rule.interval && xKind === 'datetime' && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">Date interval</span>
                  <select className="input" value={interval} onChange={(e) => setIntervalV(e.target.value)}>
                    {['auto', 'day', 'week', 'month', 'quarter', 'year'].map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </label>
              )}
            </>
          )}
        </div>
        {problems.length > 0 && <p className="mt-3 text-sm text-warn">{problems.join(' ')}</p>}
        {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className="btn-primary" disabled={busy || problems.length > 0} onClick={create}>
            {busy ? 'Computing…' : 'Create chart'}
          </button>
          <span className="text-xs text-ink-faint">Aggregation happens on the server over all rows; the chart and its table are saved to this session.</span>
        </div>
      </section>

      {busy && <Spinner label="Computing chart on the server…" />}
      {charts.length === 0 ? (
        <p className="text-sm text-ink-soft">No charts yet. Choose a chart type and columns above.</p>
      ) : (
        [...charts].reverse().map((c) => (
          <article key={c.id} className="card p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="font-semibold">{c.title}</h3>
              <button type="button" className="btn-secondary" onClick={() => remove(c.id)} aria-label={`Remove chart ${c.title}`}>
                <Trash2 aria-hidden className="h-4 w-4" />
              </button>
            </div>
            <ResultView result={c} compact />
          </article>
        ))
      )}
    </div>
  );
}
