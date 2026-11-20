import { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Badge, TableNameContext } from './ui';

/** Report pages for which the export ships a public page image (reference_figures/report_page_N.png). */
export const REPORT_PAGE_IMAGES = new Set([15, 17, 18, 19, 20, 21, 22, 24, 26, 27, 29, 31]);

/**
 * Frame for every report figure and table: exact report caption, a badge saying whether the reader
 * sees the published view or an exploration (with a reset), optional controls and short notes.
 * Legacy props (itemId, page, downloads, dataView) are accepted for call-site compatibility but are
 * intentionally not rendered: the per-figure data/provenance/compare panels were removed from the UI.
 */
export function FigureFrame({
  kind = 'Figure',
  label,
  caption,
  exploring = false,
  onReset,
  controls,
  children,
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
  downloads?: unknown[];
  children: ReactNode;
  dataView?: ReactNode;
  notes?: ReactNode;
}) {
  const anchor = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const captionId = `${anchor}-caption`;
  return (
    <figure
      id={anchor}
      aria-labelledby={captionId}
      className="my-8 scroll-mt-28 overflow-hidden rounded-lg border border-paper-line bg-paper-card shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-paper-line px-4 py-3 sm:px-5">
        <figcaption id={captionId} className="max-w-3xl text-[0.95rem] leading-snug text-ink">
          <span className="font-semibold">{label}.</span> {caption}
        </figcaption>
        <div className="flex shrink-0 flex-wrap items-center gap-2" aria-live="polite">
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
            <Badge tone="accent">{kind === 'Table' ? 'As published' : 'Published report view'}</Badge>
          )}
        </div>
      </div>
      {controls && <div className="flex flex-wrap items-center gap-3 border-b border-paper-line bg-paper px-4 py-2.5 sm:px-5">{controls}</div>}
      <div className="px-2 py-3 sm:px-4">
        <TableNameContext.Provider value={typeof caption === 'string' ? `${label}: ${caption}` : label}>{children}</TableNameContext.Provider>
      </div>
      {notes && <div className="px-4 pb-4 text-sm leading-relaxed text-ink-soft sm:px-5">{notes}</div>}
    </figure>
  );
}
