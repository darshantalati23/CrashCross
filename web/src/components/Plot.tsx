import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Data, Layout, Config } from 'plotly.js';

// Plotly is large; load it on first chart render only.
const LazyPlot = lazy(async () => {
  const [{ default: createPlotlyComponent }, Plotly] = await Promise.all([
    import('react-plotly.js/factory'),
    import('plotly.js-cartesian-dist-min'),
  ]);
  return { default: createPlotlyComponent((Plotly as { default?: unknown }).default ?? Plotly) };
});

export const PALETTE = {
  primary: '#1f5f8b',
  secondary: '#c0692b',
  tertiary: '#5a8f5a',
  muted: '#9aa4b1',
  red: '#c0392b',
  blue: '#2a63b5',
  grid: '#e7e4dd',
  ink: '#1c2430',
};

const baseLayout: Partial<Layout> = {
  font: { family: '"Source Sans 3", system-ui, sans-serif', size: 13, color: PALETTE.ink },
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  margin: { l: 60, r: 20, t: 36, b: 52 },
  hoverlabel: { bgcolor: '#ffffff', bordercolor: '#c9c4b8', font: { color: PALETTE.ink, size: 13 } },
  legend: { orientation: 'h', y: -0.2 },
  xaxis: { gridcolor: PALETTE.grid, zeroline: false, automargin: true },
  yaxis: { gridcolor: PALETTE.grid, zeroline: false, automargin: true },
};

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(m.matches);
    const h = () => setR(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);
  return r;
}

export interface PlotProps {
  data: Data[];
  layout?: Partial<Layout>;
  height?: number;
  config?: Partial<Config>;
  ariaLabel: string;
  onClick?: (e: Readonly<Plotly.PlotMouseEvent>) => void;
}

function deepMerge<T extends object>(a: T, b: Partial<T>): T {
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
  for (const [k, v] of Object.entries(b ?? {})) {
    const av = out[k];
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && av && typeof av === 'object'
        ? deepMerge(av as object, v as object)
        : v;
  }
  return out as T;
}

/** Width of an element, tracked with ResizeObserver. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Plot({ data, layout, height = 380, config, ariaLabel, onClick }: PlotProps) {
  const reduced = useReducedMotion();
  const [box, width] = useWidth<HTMLDivElement>();
  // Fresh copies every render: Plotly writes autodetected axis types back into the layout object it
  // receives, so a shared base object would leak e.g. a category y-axis from one chart into the next.
  const merged = deepMerge(structuredClone(baseLayout), { ...structuredClone(layout ?? {}), height, autosize: true } as Partial<Layout>);
  if (width < 640) {
    // Phones: compact margins and fonts so the plotting area keeps most of the width.
    const m = (merged.margin ?? {}) as { l?: number; r?: number; t?: number; b?: number };
    merged.margin = { ...m, l: Math.min(m.l ?? 60, 90), r: Math.min(m.r ?? 20, 12) };
    merged.font = { ...(merged.font ?? {}), size: 11 };
    for (const ax of ['xaxis', 'yaxis'] as const) {
      const a = (merged[ax] ?? {}) as Partial<Plotly.LayoutAxis>;
      const t = a.title as { text?: string; font?: object } | undefined;
      if (t && typeof t === 'object') a.title = { ...t, font: { size: 10 } } as Plotly.LayoutAxis['title'];
      merged[ax] = a as Layout['xaxis'];
    }
  }
  if (reduced) (merged as Layout).transition = { duration: 0 } as Layout['transition'];
  return (
    <div ref={box} role="img" aria-label={ariaLabel} className="w-full min-w-0">
      <Suspense
        fallback={
          <div className="flex items-center justify-center text-sm text-ink-faint" style={{ height }}>
            Loading chart…
          </div>
        }
      >
        <LazyPlot
          data={data.map((t) => ({ ...t }))}
          layout={merged}
          useResizeHandler
          style={{ width: '100%', height }}
          onClick={onClick}
          config={{
            displaylogo: false,
            responsive: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
            toImageButtonOptions: { format: 'png', scale: 2 },
            ...(width < 640 ? { displayModeBar: false } : {}),
            ...config,
          }}
        />
      </Suspense>
    </div>
  );
}
