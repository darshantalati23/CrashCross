import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, Download, FileImage } from 'lucide-react';
import { DATA_BASE, useJson } from '../lib/data';
import { Badge, Disclosure } from './ui';

/** Report pages for which the export ships a public page image (reference_figures/report_page_N.png). */
export const REPORT_PAGE_IMAGES = new Set([15, 17, 18, 19, 20, 21, 22, 24, 26, 27, 29, 31]);

interface CatalogueItem {
  item_id: string;
  report_identifier?: string;
  calculation_description?: string;
  filtering_rules?: string;
  year_range?: number[];
  numerator?: string;
  denominator?: string;
  units?: string;
  missing_value_handling?: string;
  caveats?: string[];
  source_notebook_cell_indices?: number[];
  verification_status?: string;
  verification_reason?: string;
  report_pdf_pages_1_based?: number[];
}

export function useCatalogue() {
  return useJson<Record<string, CatalogueItem>>('derived/catalogue_items.json');
}

export interface DownloadLink {
  label: string;
  path: string; // relative to /data
}

function Provenance({ itemId }: { itemId?: string }) {
  const cat = useCatalogue();
  if (!itemId) return null;
  const it = cat.data?.[itemId];
  if (cat.loading) return <p className="text-ink-faint">Loading provenance…</p>;
  if (!it) return <p className="text-ink-faint">No catalogue entry for this item.</p>;
  const rows: [string, ReactNode][] = [
    ['Calculation', it.calculation_description],
    ['Records included', it.filtering_rules],
    ['Years', it.year_range ? `${it.year_range[0]}–${it.year_range[1]}` : undefined],
    ['Numerator', it.numerator],
    ['Denominator', it.denominator],
    ['Units', it.units],
    ['Missing values', it.missing_value_handling],
    ['Notebook cells (0-based)', it.source_notebook_cell_indices?.join(', ')],
    [
      'Export verification',
      it.verification_status ? (
        <span>
          <Badge tone={it.verification_status === 'passed' ? 'ok' : 'warn'}>{it.verification_status}</Badge>{' '}
          {it.verification_reason}
        </span>
      ) : undefined,
    ],
  ];
  // The generic caveat list repeats across items; show only item-specific first entry plus boundaries.
  return (
    <div className="space-y-3">
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[11rem_1fr]">
        {rows
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-ink">{k}</dt>
              <dd className="text-ink-soft">{v}</dd>
            </div>
          ))}
      </dl>
      {it.caveats && it.caveats.length > 0 && (
        <div>
          <p className="font-semibold text-ink">Interpretation boundaries</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">
            {it.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function FigureFrame({
  kind = 'Figure',
  label,
  caption,
  itemId,
  page,
  exploring = false,
  onReset,
  controls,
  downloads = [],
  children,
  dataView,
  notes,
}: {
  kind?: 'Figure' | 'Table';
  label: string;
  caption: ReactNode;
  itemId?: string;
  page?: number;
  exploring?: boolean;
  onReset?: () => void;
  controls?: ReactNode;
  downloads?: DownloadLink[];
  children: ReactNode;
  dataView?: ReactNode;
  notes?: ReactNode;
}) {
  const anchor = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <figure id={anchor} className="my-8 scroll-mt-24 rounded-lg border border-paper-line bg-paper-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-paper-line px-4 py-3">
        <figcaption className="max-w-3xl text-[0.95rem] leading-snug text-ink">
          <span className="font-semibold">{label}:</span> {caption}
        </figcaption>
        <div className="flex items-center gap-2">
          {exploring ? (
            <>
              <Badge tone="warn">Exploring — differs from published view</Badge>
              {onReset && (
                <button type="button" onClick={onReset} className="btn-secondary">
                  <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Report view
                </button>
              )}
            </>
          ) : (
            <Badge tone="accent">Published report view</Badge>
          )}
        </div>
      </div>
      {controls && <div className="flex flex-wrap items-center gap-3 border-b border-paper-line bg-paper px-4 py-2.5">{controls}</div>}
      <div className="px-2 py-3 sm:px-4">{children}</div>
      {notes && <div className="px-4 pb-3 text-sm text-ink-soft">{notes}</div>}
      <div className="space-y-2 px-4 pb-4">
        {(dataView || downloads.length > 0) && (
          <Disclosure summary={`${kind === 'Figure' ? 'Data' : 'Downloads'} and exact values`}>
            {dataView}
            {downloads.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {downloads.map((d) => (
                  <a key={d.path} className="btn-secondary" href={`${DATA_BASE}/${d.path}`} download>
                    <Download aria-hidden className="h-3.5 w-3.5" /> {d.label}
                  </a>
                ))}
              </div>
            )}
          </Disclosure>
        )}
        {itemId && (
          <Disclosure summary="How this was computed">
            <Provenance itemId={itemId} />
          </Disclosure>
        )}
        {page && (
          <Disclosure summary={`Compare with the report (PDF page ${page})`}>
            {REPORT_PAGE_IMAGES.has(page) ? (
              <img
                src={`${DATA_BASE}/reference_figures/report_page_${page}.png`}
                alt={`Static image of report PDF page ${page}, containing ${label} as published.`}
                loading="lazy"
                className="mx-auto max-h-[80vh] rounded border border-paper-line"
              />
            ) : null}
            <p className="mt-2 text-ink-faint">
              <FileImage aria-hidden className="mr-1 inline h-4 w-4" />
              Static page image from the report, for comparison only.{' '}
              <Link className="link" to={`/report?page=${page}`}>
                Open page {page} in the report viewer
              </Link>
              .
            </p>
          </Disclosure>
        )}
      </div>
    </figure>
  );
}
