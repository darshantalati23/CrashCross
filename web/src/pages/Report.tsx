import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, ZoomIn, ZoomOut, BookOpen, Rows3, ExternalLink } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { DATA_BASE } from '../lib/data';
import { ErrorNote, Segmented, Spinner } from '../components/ui';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const PDF_URL = `${DATA_BASE}/resources/report.pdf`;
const DOWNLOAD_NAME = 'EDA_report_Allegheny_crashes_GroupB8.pdf';

const OUTLINE: [string, number][] = [
  ['Title page', 1], ['Contents', 5], ['List of figures', 7], ['List of tables', 9], ['Abstract', 10],
  ['1 Introduction', 11], ['2 Data Cleaning', 13], ['3 Visualization', 17], ['4 Feature Engineering', 25],
  ['5 Model Fitting', 28], ['6 Conclusion & Future Scope', 32], ['Appendix A', 35], ['Appendix B', 37], ['Appendix C', 38],
  ['Appendix D', 39], ['Appendix E', 41], ['Appendix F', 43], ['Appendix G', 45], ['Group contribution', 48], ['Short bio', 49], ['References', 50],
];

function usePrefersReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setR(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);
  return r;
}

/** One PDF page as canvas + selectable text layer. */
function PdfPage({ doc, pageNumber, height, lazy = false }: { doc: PDFDocumentProxy; pageNumber: number; height: number; lazy?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [shouldRender, setShouldRender] = useState(!lazy);

  // Lazy rendering in scroll mode: render when within ~600px of the viewport.
  useEffect(() => {
    if (!lazy || !wrap.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShouldRender(true), { rootMargin: '600px 0px' });
    io.observe(wrap.current);
    return () => io.disconnect();
  }, [lazy]);

  useEffect(() => {
    if (!shouldRender) return;
    let cancelled = false;
    let task: ReturnType<PDFPageProxy['render']> | null = null;
    let textLayer: pdfjs.TextLayer | null = null;
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = height / base.height;
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = canvas.current!;
      c.width = Math.floor(viewport.width * dpr);
      c.height = Math.floor(viewport.height * dpr);
      c.style.width = `${viewport.width}px`;
      c.style.height = `${viewport.height}px`;
      setSize({ w: viewport.width, h: viewport.height });
      const ctx = c.getContext('2d')!;
      task = page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      try {
        await task.promise;
      } catch {
        return;
      }
      if (cancelled || !textRef.current) return;
      textRef.current.replaceChildren();
      textRef.current.style.setProperty('--scale-factor', String(scale));
      textLayer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textRef.current, viewport });
      await textLayer.render().catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      textLayer?.cancel();
    };
  }, [doc, pageNumber, height, shouldRender]);

  const approxW = size?.w ?? height * 0.7727; // A4-ish placeholder before render
  return (
    <div
      ref={wrap}
      data-page={pageNumber}
      className="relative bg-white shadow-md"
      style={{ width: approxW, height: size?.h ?? height }}
      aria-label={`Report page ${pageNumber}`}
      role="region"
    >
      <canvas ref={canvas} className="block" aria-hidden />
      <div ref={textRef} className="textLayer" />
    </div>
  );
}

/** Render a page to an image for the page-turn animation leaf. */
async function snapshot(doc: PDFDocumentProxy, n: number, height: number): Promise<string> {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: height / page.getViewport({ scale: 1 }).height });
  const c = document.createElement('canvas');
  c.width = Math.floor(vp.width);
  c.height = Math.floor(vp.height);
  await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise;
  return c.toDataURL('image/jpeg', 0.85);
}

/** Pages shown together in book mode: page 1 alone (cover), then 2–3, 4–5, … */
function spreadFor(page: number, total: number): number[] {
  if (page <= 1) return [1];
  const left = page % 2 === 0 ? page : page - 1;
  return left + 1 <= total ? [left, left + 1] : [left];
}

export function ReportPage() {
  const [params, setParams] = useSearchParams();
  const reduced = usePrefersReducedMotion();
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(() => Math.max(1, Number(params.get('page')) || 1));
  const [zoom, setZoom] = useState(1);
  const [isWide, setIsWide] = useState(() => window.innerWidth >= 1024);
  const [mode, setMode] = useState<'book' | 'scroll'>(() => (window.innerWidth >= 1024 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'book' : 'scroll'));
  const [fullscreen, setFullscreen] = useState(false);
  const [flip, setFlip] = useState<{ dir: 1 | -1; front: string; back: string; under: number[] } | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const [stageH, setStageH] = useState(700);
  const scrollBox = useRef<HTMLDivElement | null>(null);
  const total = doc?.numPages ?? 50;
  const suppressVisible = useRef(0); // ignore page-visibility updates while we scroll programmatically

  useEffect(() => {
    let alive = true;
    const task = pdfjs.getDocument({ url: PDF_URL });
    task.promise
      .then((d) => alive && setDoc(d))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false; // ignore results of a load cancelled by unmount (e.g. StrictMode re-mount)
      task.destroy();
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsWide(window.innerWidth >= 1024);
      if (stage.current) setStageH(stage.current.clientHeight);
    };
    onResize();
    window.addEventListener('resize', onResize);
    const onFs = () => {
      setFullscreen(!!document.fullscreenElement);
      setTimeout(onResize, 50);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [mode]);

  // Keep ?page= in the URL.
  useEffect(() => {
    if (Number(params.get('page')) !== page) setParams({ page: String(page) }, { replace: true });
  }, [page, params, setParams]);

  const effectiveMode = mode === 'book' && !isWide ? 'scroll' : mode;
  const pageH = Math.max(320, (stageH - 32) * zoom);
  const spread = spreadFor(page, total);

  const goTo = useCallback(
    async (target: number) => {
      const t = Math.min(Math.max(1, target), total);
      if (effectiveMode === 'scroll') {
        setPage(t);
        suppressVisible.current = Date.now() + 1200;
        scrollWithin(scrollBox.current, t);
        return;
      }
      const cur = spreadFor(page, total);
      const nxt = spreadFor(t, total);
      if (cur[0] === nxt[0]) return setPage(t);
      if (reduced || !doc || flip) return setPage(t);
      const forward = nxt[0] > cur[0];
      // Leaf: forward flips current right page over to reveal next left page; backward the reverse.
      const frontN = forward ? cur[cur.length - 1] : cur[0];
      const backN = forward ? nxt[0] : nxt[nxt.length - 1];
      try {
        const [front, back] = await Promise.all([snapshot(doc, frontN, pageH), snapshot(doc, backN, pageH)]);
        // Underneath the moving leaf: the page that stays put plus the newly revealed page.
        const under = forward ? [cur[0], nxt[1] ?? nxt[0]] : [nxt[0], cur[cur.length - 1]];
        setFlip({ dir: forward ? 1 : -1, front, back, under: cur.length === 1 || nxt.length === 1 ? (forward ? nxt : cur) : under });
        setTimeout(() => {
          setPage(t);
          setFlip(null);
        }, 650);
      } catch {
        setPage(t);
      }
    },
    [effectiveMode, page, total, reduced, doc, flip, pageH],
  );

  const step = effectiveMode === 'book' ? (page <= 1 ? 1 : 2) : 1;
  const next = () => goTo(effectiveMode === 'book' ? (spread[spread.length - 1] + 1) : page + 1);
  const prev = () => goTo(effectiveMode === 'book' ? spread[0] - 1 : page - 1);
  void step;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,select,textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) shell.current?.requestFullscreen?.().catch(() => undefined);
    else document.exitFullscreen().catch(() => undefined);
  };

  const onVisible = useCallback((n: number) => {
    if (Date.now() > suppressVisible.current) setPage(n);
  }, []);
  const pages = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);
  const [pageInput, setPageInput] = useState(String(page));
  useEffect(() => setPageInput(String(page)), [page]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">The report</h1>
          <p className="mt-1 text-ink-soft">
            “Exploratory Data Analysis on Road Accidents in Allegheny County, Pennsylvania” — Group B8, IT 462, 18 November 2026 · 50 pages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn-primary" href={PDF_URL} download={DOWNLOAD_NAME}><Download aria-hidden className="h-4 w-4" /> Download PDF (1.4 MB)</a>
          <a className="btn-secondary" href={PDF_URL} target="_blank" rel="noreferrer"><ExternalLink aria-hidden className="h-4 w-4" /> Open in browser viewer</a>
        </div>
      </div>

      <div ref={shell} className={`card flex flex-col overflow-hidden ${fullscreen ? 'h-screen rounded-none' : ''}`} style={fullscreen ? undefined : { height: 'calc(100vh - 11rem)', minHeight: 520 }}>
        <div className="flex flex-wrap items-center gap-2 border-b border-paper-line bg-paper px-3 py-2" role="toolbar" aria-label="Report viewer controls">
          <button type="button" className="btn-secondary" onClick={prev} disabled={page <= 1 || !!flip} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="sr-only">Page number</span>
            Page
            <input
              className="input w-16 py-1 text-center"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && goTo(Number(pageInput) || 1)}
              onBlur={() => goTo(Number(pageInput) || page)}
            />
            of {total}
          </label>
          <button type="button" className="btn-secondary" onClick={next} disabled={spread[spread.length - 1] >= total && page >= total || !!flip} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          <label className="ml-1 flex items-center gap-1.5 text-sm">
            <span className="hidden sm:inline">Go to</span>
            <select className="input py-1" value="" onChange={(e) => e.target.value && goTo(Number(e.target.value))} aria-label="Jump to section">
              <option value="">Section…</option>
              {OUTLINE.map(([l, p]) => <option key={l} value={p}>{l} (p. {p})</option>)}
            </select>
          </label>
          <span className="mx-1 hidden h-6 w-px bg-paper-line sm:block" />
          <button type="button" className="btn-secondary" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
          <span className="w-12 text-center text-sm tabular-nums" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" className="btn-secondary" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
          <button type="button" className="btn-secondary" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <div className="ml-auto">
            {isWide ? (
              <Segmented label="Reading mode" value={mode} onChange={setMode}
                options={[{ value: 'book', label: 'Book' }, { value: 'scroll', label: 'Scroll' }]} />
            ) : (
              <span className="flex items-center gap-1 text-xs text-ink-faint"><Rows3 aria-hidden className="h-4 w-4" /> Scroll view</span>
            )}
          </div>
        </div>

        {error ? (
          <div className="space-y-3 p-4">
            <ErrorNote>The interactive reader could not load ({error}). The browser’s built-in PDF viewer is shown instead.</ErrorNote>
            <object data={PDF_URL} type="application/pdf" className="h-[75vh] w-full" aria-label="Report PDF">
              <p className="text-sm">Your browser cannot display PDFs inline. <a className="link" href={PDF_URL} download={DOWNLOAD_NAME}>Download the report</a>.</p>
            </object>
          </div>
        ) : !doc ? (
          <div className="flex flex-1 items-center justify-center"><Spinner label="Loading the report…" /></div>
        ) : effectiveMode === 'book' ? (
          <div ref={stage} className="relative flex-1 overflow-auto bg-[#e9e6df]">
            <div className="flex min-h-full items-center justify-center p-4" style={{ perspective: 2400 }}>
              <div className="relative flex" aria-live="polite" aria-label={`Showing page${spread.length > 1 ? 's' : ''} ${spread.join(' and ')}`}>
                {(() => {
                  const shown = flip ? flip.under : spread;
                  const cover = shown.length === 1 && shown[0] === 1;
                  return (
                    <>
                      {cover && <div style={{ width: pageH * 0.7727 }} aria-hidden />}
                      {shown.map((n) => <PdfPage key={`${n}-${pageH}`} doc={doc} pageNumber={n} height={pageH} />)}
                      {shown.length === 1 && !cover && <div style={{ width: pageH * 0.7727 }} aria-hidden />}
                    </>
                  );
                })()}
                <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-6 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
                {flip && (
                  <div
                    aria-hidden
                    className="page-leaf absolute top-0"
                    style={{
                      width: '50%', height: '100%',
                      left: flip.dir === 1 ? '50%' : 0,
                      transformOrigin: flip.dir === 1 ? 'left center' : 'right center',
                      transformStyle: 'preserve-3d',
                      animation: `${flip.dir === 1 ? 'leaf-forward' : 'leaf-back'} 650ms ease-in-out forwards`,
                    }}
                  >
                    <img src={flip.front} alt="" className="absolute inset-0 h-full w-full shadow-xl" style={{ backfaceVisibility: 'hidden' }} />
                    <img src={flip.back} alt="" className="absolute inset-0 h-full w-full shadow-xl" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} />
                  </div>
                )}
              </div>
            </div>
            <button type="button" onClick={prev} disabled={page <= 1} aria-label="Previous pages"
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white disabled:opacity-30 xl:block"><ChevronLeft className="h-6 w-6" /></button>
            <button type="button" onClick={next} disabled={spread[spread.length - 1] >= total} aria-label="Next pages"
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white disabled:opacity-30 xl:block"><ChevronRight className="h-6 w-6" /></button>
          </div>
        ) : (
          <div ref={(el) => { scrollBox.current = el; stage.current = el; }} className="flex-1 overflow-auto bg-[#e9e6df]">
            <ScrollPages doc={doc} pages={pages} width={zoom} onVisible={onVisible} initialPage={page} onInitialScroll={() => { suppressVisible.current = Date.now() + 1500; }} />
          </div>
        )}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-faint">
        <BookOpen aria-hidden className="h-4 w-4" />
        Text in the reader is selectable. Use ← / → keys to turn pages. Book mode is used on wide screens without a reduced-motion preference;
        the scroll view is used otherwise.
      </p>
    </div>
  );
}

/** Scroll only the reader's own container (scrollIntoView would also scroll the window). */
function scrollWithin(box: HTMLElement | null, n: number) {
  const el = box?.querySelector<HTMLElement>(`[data-page="${n}"]`);
  if (!box || !el) return;
  box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
}

function ScrollPages({ doc, pages, width, onVisible, initialPage, onInitialScroll }: { doc: PDFDocumentProxy; pages: number[]; width: number; onVisible: (n: number) => void; initialPage: number; onInitialScroll: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  const didInitial = useRef(false);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  // Page height from available width (A4 portrait ratio ≈ 1.294).
  const h = Math.max(300, Math.min((w ?? 600) - 24, 900) * 1.294 * width);
  // Current page = the page occupying the top third of the reader, computed from geometry on scroll.
  useEffect(() => {
    const scroller = box.current?.parentElement;
    if (!scroller) return;
    let t = 0;
    const onScroll = () => {
      clearTimeout(t);
      t = window.setTimeout(() => {
        const line = scroller.getBoundingClientRect().top + scroller.clientHeight / 3;
        const els = box.current?.querySelectorAll<HTMLElement>('[data-page]') ?? [];
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.top <= line && r.bottom >= line) return onVisible(Number(el.dataset.page));
        }
      }, 60);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [onVisible]);
  // Jump to the requested page once the real width is known (placeholder heights depend on it).
  useEffect(() => {
    if (w === null || didInitial.current) return;
    didInitial.current = true;
    if (initialPage > 1) {
      onInitialScroll();
      setTimeout(() => scrollWithin(box.current?.parentElement ?? null, initialPage), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w]);
  return (
    <div ref={box} className="flex flex-col items-center gap-4 p-3">
      {pages.map((n) => <PdfPage key={`${n}-${Math.round(h)}`} doc={doc} pageNumber={n} height={h} lazy />)}
    </div>
  );
}
