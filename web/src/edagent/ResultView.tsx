import { Plot } from '../components/Plot';
import { DataTable, Disclosure } from '../components/ui';
import type { ResultBody } from './api';
import type { Cell, Row } from '../lib/data';

const fmt = (v: unknown) => {
  if (v === null || v === undefined) return '–';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumSignificantDigits: 5 });
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
};

export function ResultView({ result, compact = false }: { result: ResultBody; compact?: boolean }) {
  const rows = (result.table?.rows ?? []) as Row[];
  return (
    <div className="space-y-3">
      {result.figure && (
        <Plot
          ariaLabel={`${result.title}. Values are listed in the table below the chart.`}
          height={compact ? 320 : 400}
          data={result.figure.data}
          layout={{ ...result.figure.layout, title: compact ? undefined : result.figure.layout.title }}
        />
      )}
      {result.notes && result.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
          {result.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
      {result.facts && !result.figure && (
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
          {Object.entries(result.facts).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-ink">{k.replace(/_/g, ' ')}</dt>
              <dd className="tabular-nums text-ink-soft">{fmt(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {result.table && rows.length > 0 && (
        result.figure ? (
          <Disclosure summary={`Values behind this chart (${rows.length} rows)`}>
            <DataTable rows={rows} maxHeight={320} columns={result.table.columns.map((c) => ({ key: c, label: c, format: (v: Cell) => fmt(v) }))} />
          </Disclosure>
        ) : (
          <DataTable rows={rows} maxHeight={360} columns={result.table.columns.map((c) => ({ key: c, label: c, format: (v: Cell) => fmt(v) }))} />
        )
      )}
      {typeof result.rows_used === 'number' && (
        <p className="text-xs text-ink-faint">
          Computed by the EDAgent server from {result.rows_used.toLocaleString()} of {result.rows_total?.toLocaleString()} rows.
        </p>
      )}
    </div>
  );
}
