import { useEffect, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DATA_BASE } from '../lib/data';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Fractions of the page (0–1) that enclose a figure: [left, top, right, bottom]. */
export type Region = [number, number, number, number];

let docPromise: Promise<PDFDocumentProxy> | null = null;
function reportDoc() {
  docPromise ??= pdfjs.getDocument({ url: `${DATA_BASE}/resources/report.pdf` }).promise;
  return docPromise;
}

/** Renders one region of a report page from the public PDF into `canvas` at `cssWidth` CSS pixels. */
async function renderRegion(canvas: HTMLCanvasElement, pageNumber: number, region: Region, cssWidth: number) {
  const doc = await reportDoc();
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const [l, t, r, b] = region;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = (cssWidth / ((r - l) * base.width)) * dpr;
  const vp = page.getViewport({ scale });
  const full = document.createElement('canvas');
  full.width = Math.ceil(vp.width);
  full.height = Math.ceil(vp.height);
  await page.render({ canvasContext: full.getContext('2d')!, viewport: vp }).promise;
  const sx = l * vp.width, sy = t * vp.height, sw = (r - l) * vp.width, sh = (b - t) * vp.height;
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${Math.round((sh / sw) * cssWidth)}px`;
  canvas.getContext('2d')!.drawImage(full, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}

function RegionCanvas({ page, region, width, alt }: { page: number; region: Region; width: number; alt: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => {
    let alive = true;
    setState('loading');
    if (ref.current && width > 0)
      renderRegion(ref.current, page, region, width)
        .then(() => alive && setState('ok'))
        .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [page, region, width]);
  const [l, t, r, b] = region;
  return (
    <div className="relative">
      <canvas ref={ref} role="img" aria-label={alt} className={state === 'ok' ? 'block' : 'hidden'} />
      {state !== 'ok' && (
        // Fallback / placeholder: CSS crop of the published report-page image (same region).
        <div
          role={state === 'error' ? 'img' : undefined}
          aria-label={state === 'error' ? alt : undefined}
          className="relative overflow-hidden bg-white"
          style={{ width, aspectRatio: `${(r - l) * 834} / ${(b - t) * 1179}` }}
        >
          <img
            src={`${DATA_BASE}/reference_figures/report_page_${page}.png`}
            alt=""
            className="absolute max-w-none"
            style={{ width: `${100 / (r - l)}%`, left: `${(-l / (r - l)) * 100}%`, top: `${(-t / (b - t)) * 100}%` }}
          />
          {state === 'loading' && (
            <span className="absolute right-2 top-2 rounded bg-white/90 px-2 py-0.5 text-xs text-ink-soft" role="status">
              Sharpening from the report PDF…
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A report figure that cannot be rebuilt interactively: shows only the figure region of the public
 * report page (rendered from the public PDF), with an enlarged view in a modal dialog.
 */
export function ReportFigureCrop({ page, region, label, alt }: { page: number; region: Region; label: string; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [w, setW] = useState(0);
  const [open, setOpen] = useState(false);
  const [bigW, setBigW] = useState(1200);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.min(Math.floor(e.contentRect.width), 900)));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const show = () => {
    setBigW(Math.min(1800, Math.max(600, window.innerWidth * 1.4)));
    setOpen(true);
    dialog.current?.showModal();
  };
  return (
    <div ref={box} className="flex flex-col items-center gap-3">
      {w > 0 && <RegionCanvas page={page} region={region} width={w} alt={alt} />}
      <button type="button" className="btn-secondary" onClick={show}>
        <Maximize2 aria-hidden className="h-4 w-4" /> Enlarge {label}
      </button>
      <dialog
        ref={dialog}
        aria-label={`${label}, enlarged`}
        onClose={() => setOpen(false)}
        className="m-auto max-h-[92vh] w-[96vw] max-w-6xl rounded-lg border border-paper-line bg-white p-0 shadow-xl backdrop:bg-black/60"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-paper-line bg-white px-4 py-2">
          <p className="text-sm font-semibold">{label} — enlarged (scroll to pan)</p>
          <button type="button" className="btn-secondary" onClick={() => dialog.current?.close()} aria-label="Close enlarged view">
            <X aria-hidden className="h-4 w-4" /> Close
          </button>
        </div>
        <div className="overflow-auto p-3">{open && <RegionCanvas page={page} region={region} width={bigW} alt={alt} />}</div>
      </dialog>
    </div>
  );
}
