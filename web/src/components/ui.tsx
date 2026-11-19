import { ReactNode, useId, useState } from 'react';
import { ChevronDown, Info, AlertTriangle, Lightbulb } from 'lucide-react';
import { Cell, Row, toCsv } from '../lib/data';

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className = '',
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={`rounded-md border border-paper-line bg-paper-card ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-semibold text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span>{summary}</span>
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div id={id} className="border-t border-paper-line px-4 py-3 text-sm">
          {children}
        </div>
      )}
    </div>
  );
}

export function Callout({
  kind = 'note',
  title,
  children,
}: {
  kind?: 'note' | 'example' | 'caution';
  title?: string;
  children: ReactNode;
}) {
  const styles = {
    note: 'border-accent/40 bg-accent-soft',
    example: 'border-[#b9a77a] bg-[#f7f2e6]',
    caution: 'border-warn/40 bg-warn-soft',
  }[kind];
  const Icon = { note: Info, example: Lightbulb, caution: AlertTriangle }[kind];
  return (
    <aside className={`my-4 rounded-md border-l-4 px-4 py-3 ${styles}`}>
      {title && (
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon aria-hidden className="h-4 w-4" /> {title}
        </p>
      )}
      <div className="text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
    </aside>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'ok' }) {
  const t = {
    neutral: 'bg-paper text-ink-soft border-paper-line',
    accent: 'bg-accent-soft text-accent-dark border-accent/30',
    warn: 'bg-warn-soft text-warn border-warn/30',
    ok: 'bg-[#e8f3ea] text-[#2f6b3a] border-[#2f6b3a]/30',
  }[tone];
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
  format?: (v: Cell, row: Row) => ReactNode;
}

export function DataTable({
  rows,
  columns,
  caption,
  maxHeight,
  footnote,
}: {
  rows: Row[];
  columns: Column[];
  caption?: ReactNode;
  maxHeight?: number;
  footnote?: ReactNode;
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-paper-line" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-0 bg-[#f3f1ec]">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap border-b border-paper-line px-3 py-2 font-semibold text-ink ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-white even:bg-paper">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-b border-paper-line/70 px-3 py-1.5 align-top ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  >
                    {c.format ? c.format(r[c.key], r) : r[c.key] ?? '–'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="mt-2 text-xs leading-relaxed text-ink-faint">{footnote}</p>}
    </div>
  );
}

export function downloadText(filename: string, text: string, type = 'text/csv') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DownloadRowsButton({ rows, filename }: { rows: Row[]; filename: string }) {
  return (
    <button type="button" className="btn-secondary" onClick={() => downloadText(filename, toCsv(rows))}>
      Download CSV
    </button>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-md border border-paper-line bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2.5 py-1 text-sm ${value === o.value ? 'bg-accent text-white' : 'text-ink-soft hover:bg-paper'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-sm text-ink-faint">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent motion-reduce:animate-none" />
      {label}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn">
      {children}
    </div>
  );
}
