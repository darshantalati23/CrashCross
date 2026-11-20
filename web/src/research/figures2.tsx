import { useMemo, useState } from 'react';
import type { Data } from 'plotly.js';
import { Link } from 'react-router-dom';
import { FigureFrame, REPORT_PAGE_IMAGES } from '../components/FigureFrame';
import { Plot, PALETTE } from '../components/Plot';
import { Badge, DataTable, Segmented } from '../components/ui';
import { ReportFigureCrop, type Region } from '../components/ReportFigureCrop';
import { DATA_BASE, Row, fmtFixed, fmtInt, useCsvs, useJson } from '../lib/data';
import { Loading } from './figures';

const num = (v: unknown) => (v === null || v === undefined ? NaN : Number(v));
const col = (rows: Row[], k: string) => rows.map((r) => r[k]);

// ---------------------------------------------------------------------------------
// Chapter 4 — maps
// ---------------------------------------------------------------------------------

/** A report figure that cannot be reconstructed from publishable data: show the report page. */
/** Figure regions on the public report pages, as fractions [left, top, right, bottom]. */
const FIGURE_REGIONS: Record<number, Region> = {
  26: [0.13, 0.458, 0.87, 0.862], // Figure 4.1
  27: [0.085, 0.19, 0.915, 0.364], // Figure 4.2
};

/** A report figure that cannot be rebuilt from publishable data: shows the published figure itself. */
export function ReferenceImageFigure({
  label, caption, page, reason,
}: { label: string; caption: string; page: number; itemId?: string; reason: string }) {
  const anchor = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const region = FIGURE_REGIONS[page];
  return (
    <figure id={anchor} aria-labelledby={`${anchor}-caption`} className="my-8 scroll-mt-28 overflow-hidden rounded-lg border border-paper-line bg-paper-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-paper-line px-4 py-3 sm:px-5">
        <figcaption id={`${anchor}-caption`} className="max-w-3xl text-[0.95rem] leading-snug text-ink">
          <span className="font-semibold">{label}.</span> {caption}
        </figcaption>
        <Badge tone="neutral">Image from the report — not interactive</Badge>
      </div>
      <div className="px-3 py-4 sm:px-5">
        {region ? (
          <ReportFigureCrop page={page} region={region} label={label} alt={`${label} as published in the report: ${caption}`} />
        ) : REPORT_PAGE_IMAGES.has(page) && (
          <img src={`${DATA_BASE}/reference_figures/report_page_${page}.png`} loading="lazy"
            alt={`Report page ${page} showing ${label} as published: ${caption}`}
            className="mx-auto max-h-[85vh] rounded border border-paper-line" />
        )}
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          <strong className="text-ink">Why an image:</strong> {reason}{' '}
          <Link className="link" to={`/report?page=${page}`}>See it on page {page} of the report</Link>.
        </p>
      </div>
    </figure>
  );
}

interface GridData { lat: number[]; lon: number[]; count: number[]; years: number[]; decimals: number }
interface GeoJson { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] }

function boundaryTraces(geo: GeoJson | null): Data[] {
  if (!geo) return [];
  const xs: (number | null)[] = [];
  const ys: (number | null)[] = [];
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    for (const poly of polys) for (const ring of poly) {
      for (const [x, y] of ring) { xs.push(x); ys.push(y); }
      xs.push(null); ys.push(null);
    }
  }
  return [{ type: 'scatter', mode: 'lines', x: xs, y: ys, line: { color: '#333', width: 1.2 }, hoverinfo: 'skip', name: 'County boundary', showlegend: false }];
}

export function RoundedGridMap() {
  const [dec, setDec] = useState<'2' | '3'>('2');
  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const grid = useJson<GridData>(`derived/rounded_grid_${dec}.json`);
  const geo = useJson<GeoJson>('spatial/county_boundary.geojson');
  const [picked, setPicked] = useState<{ lat: number; lon: number; n: number; y: number } | null>(null);

  const heat = useMemo(() => {
    const g = grid.data;
    if (!g) return null;
    const step = 10 ** -g.decimals;
    const latMin = Math.min(...g.lat), latMax = Math.max(...g.lat);
    const lonMin = Math.min(...g.lon), lonMax = Math.max(...g.lon);
    const ny = Math.round((latMax - latMin) / step) + 1, nx = Math.round((lonMax - lonMin) / step) + 1;
    const z: (number | null)[][] = Array.from({ length: ny }, () => new Array(nx).fill(null));
    const cd: (number | null)[][] = Array.from({ length: ny }, () => new Array(nx).fill(null));
    let max = 0, maxAt = [0, 0];
    g.count.forEach((c, i) => {
      const yi = Math.round((g.lat[i] - latMin) / step), xi = Math.round((g.lon[i] - lonMin) / step);
      z[yi][xi] = scale === 'log' ? Math.log10(c) : c;
      cd[yi][xi] = g.years[i];
      if (c > max) { max = c; maxAt = [g.lat[i], g.lon[i]]; }
    });
    const x = Array.from({ length: nx }, (_, i) => +(lonMin + i * step).toFixed(g.decimals));
    const y = Array.from({ length: ny }, (_, i) => +(latMin + i * step).toFixed(g.decimals));
    const raw = new Map(g.count.map((c, i) => [`${g.lat[i].toFixed(g.decimals)},${g.lon[i].toFixed(g.decimals)}`, c]));
    return { z, cd, x, y, max, maxAt, cells: g.count.length, total: g.count.reduce((a, b) => a + b, 0), raw };
  }, [grid.data, scale]);

  return (
    <FigureFrame
      label="Supplementary map"
      caption={`Historical concentration of located crash reports on a ${dec}-decimal rounded coordinate grid, 2004–2024. Counts are not exposure-adjusted and a grid cell is not a road site.`}
      itemId="supplementary_rounded_grid"
      exploring={scale !== 'linear' || dec !== '2'}
      onReset={() => { setScale('linear'); setDec('2'); setPicked(null); }}
      controls={
        <>
          <Segmented label="Grid resolution" value={dec} onChange={(v) => { setDec(v); setPicked(null); }}
            options={[{ value: '2', label: 'Coarse (0.01°)' }, { value: '3', label: 'Fine (0.001°)' }]} />
          <Segmented label="Colour scale" value={scale} onChange={setScale}
            options={[{ value: 'linear', label: 'Linear colour' }, { value: 'log', label: 'Log₁₀ colour' }]} />
        </>
      }
      downloads={[
        { label: 'rounded_grid_2.csv', path: 'spatial/rounded_grid_2.csv' },
        { label: 'rounded_grid_3.csv', path: 'spatial/rounded_grid_3.csv' },
        { label: 'county_boundary.geojson', path: 'spatial/county_boundary.geojson' },
      ]}
      notes={
        <>
          <p>
            This is <strong>not</strong> Figure 4.1 or 4.2 (those are hexbin maps shown above as report images). It renders the exported
            pandas round-to-{dec}-decimal grid summaries that support the report’s statement that the highest-count cell holds
            2,409 records at the coarse resolution and 472 at the finer one. Empty cells mean no located record was rounded there, not
            zero risk. Drag to pan, scroll to zoom, double-click to reset the zoom, and click a cell for its values.
          </p>
          {heat && (
            <p className="mt-2">
              Grid summary: <strong>{fmtInt(heat.cells)}</strong> occupied cells; <strong>{fmtInt(heat.total)}</strong> located records;
              highest-count cell <strong>{fmtInt(heat.max)}</strong> records at {heat.maxAt[0].toFixed(Number(dec))}° N, {Math.abs(heat.maxAt[1]).toFixed(Number(dec))}° W.
            </p>
          )}
          {picked && (
            <p className="mt-2 rounded bg-accent-soft px-3 py-2">
              Selected cell {picked.lat.toFixed(Number(dec))}° N, {Math.abs(picked.lon).toFixed(Number(dec))}° W: <strong>{fmtInt(picked.n)}</strong> crash records over {picked.y} observed years.
            </p>
          )}
        </>
      }
    >
      {!heat || !geo.data ? <Loading state={grid.error ? grid : geo} /> : (
        <Plot
          ariaLabel={`Grid map of crash-report counts at ${dec}-decimal resolution with the Allegheny County boundary; highest cell ${heat.max} records.`}
          height={620}
          onClick={(e) => {
            const p = e.points?.[0];
            if (!p || p.data.type !== 'heatmap') return;
            const lat = Number(p.y), lon = Number(p.x);
            const key = `${lat.toFixed(Number(dec))},${lon.toFixed(Number(dec))}`;
            const n = heat.raw.get(key);
            if (n !== undefined) setPicked({ lat, lon, n, y: Number((p as unknown as { customdata: number }).customdata) });
          }}
          data={[
            {
              type: 'heatmap', x: heat.x, y: heat.y, z: heat.z, customdata: heat.cd as unknown as number[][],
              colorscale: 'Viridis', hoverongaps: false,
              colorbar: { title: { text: scale === 'log' ? 'log₁₀ records' : 'Records' } },
              hovertemplate: scale === 'log'
                ? 'Lat %{y}, Lon %{x}<br>10^%{z:.2f} records<br>%{customdata} years observed<extra></extra>'
                : 'Lat %{y}, Lon %{x}<br>%{z:,} records<br>%{customdata} years observed<extra></extra>',
            } as Data,
            ...boundaryTraces(geo.data),
          ]}
          layout={{
            margin: { l: 60, r: 10, t: 10, b: 50 },
            xaxis: { type: 'linear', title: { text: 'Longitude (EPSG:4326)' }, showgrid: false },
            yaxis: { type: 'linear', title: { text: 'Latitude' }, scaleanchor: 'x', scaleratio: 1 / Math.cos((40.45 * Math.PI) / 180), showgrid: false },
            dragmode: 'pan',
          }}
          config={{ scrollZoom: true }}
        />
      )}
    </FigureFrame>
  );
}

export function LocationAuditTables() {
  const s = useCsvs({ cand: 'spatial/candidate_coordinate_summary.csv' });
  return !s.data ? <Loading state={s} /> : (
    <DataTable rows={s.data.cand} columns={[
      { key: 'coordinate_format_hypothesis', label: 'Police-format hypothesis' },
      { key: 'official_format_verified', label: 'Officially verified' },
      { key: 'comparable_candidate_pairs', label: 'Candidate pairs', align: 'right', format: fmtInt },
      { key: 'median_difference_m', label: 'Median diff. (m)', align: 'right', format: (v) => fmtFixed(v, 2) },
      { key: 'p95_difference_m', label: 'P95 (m)', align: 'right', format: (v) => fmtFixed(v, 2) },
      { key: 'p99_difference_m', label: 'P99 (m)', align: 'right', format: (v) => fmtFixed(v, 2) },
      { key: 'candidate_pairs_over_500m', label: '> 500 m', align: 'right', format: fmtInt },
      { key: 'candidate_pairs_over_500m_percent', label: '> 500 m %', align: 'right', format: (v) => fmtFixed(v, 2) },
    ]} footnote="Exported candidate-coordinate comparison (spatial/candidate_coordinate_summary.csv). The police format was not accepted as an official location source." />
  );
}

// ---------------------------------------------------------------------------------
// Chapter 5 — models
// ---------------------------------------------------------------------------------

export const MODEL_IDS: Record<string, string> = {
  'Logistic Regression + collision': 'logistic_regression_plus_collision',
  'Random Forest + collision': 'random_forest_plus_collision',
  'Random Forest without collision': 'random_forest_without_collision',
  'HistGradientBoosting + collision': 'histgradientboosting_plus_collision',
};
const MODEL_COLOURS: Record<string, string> = {
  'Majority-class baseline': PALETTE.muted,
  'Random Forest without collision': '#8c8c8c',
  'Logistic Regression + collision': '#4c72b0',
  'Random Forest + collision': '#55a868',
  'HistGradientBoosting + collision': '#c44e52',
  'Temporally calibrated logistic': '#8172b3',
  'Benchmark Random Forest (2004–2021)': '#937860',
};

export function Figure5_1() {
  const s = useCsvs({ d: 'chart_data/report_figure_5_1/model_bars.csv' });
  const d = s.data?.d ?? [];
  return (
    <FigureFrame
      label="Figure 5.1"
      caption="Average precision and precision among the highest-scored 5% of the chronological test records. The event prevalence is 4.44%; ranking gains are useful but remain modest and retrospective."
      itemId="report_figure_5_1"
      page={29}
      downloads={[{ label: 'model_bars.csv', path: 'chart_data/report_figure_5_1/model_bars.csv' }]}
      dataView={s.data && (
        <DataTable rows={d} columns={[
          { key: 'model', label: 'Model' },
          { key: 'average_precision', label: 'Average precision', align: 'right', format: (v) => fmtFixed(v, 4) },
          { key: 'precision_top5', label: 'Precision, top 5%', align: 'right', format: (v) => fmtFixed(v, 4) },
        ]} footnote="Test years 2022–2024, n = 27,697, 1,231 serious/fatal. The baseline equals the exact test prevalence 0.044445…" />
      )}
      notes="Click a legend entry to hide or show a metric. Dashed line: test-set prevalence (4.44%)."
    >
      {!s.data ? <Loading state={s} /> : (
        <Plot
          ariaLabel="Grouped bar chart of average precision and top-5% precision by model; HistGradientBoosting + collision highest at 0.1548 and 0.2238."
          height={400}
          data={[
            { type: 'bar', name: 'Average precision', x: col(d, 'model') as string[], y: col(d, 'average_precision') as number[], marker: { color: '#4c72b0' },
              hovertemplate: '<b>%{x}</b><br>Average precision %{y:.4f}<extra></extra>' },
            { type: 'bar', name: 'Precision among top 5%', x: col(d, 'model') as string[], y: col(d, 'precision_top5') as number[], marker: { color: '#dd8452' },
              hovertemplate: '<b>%{x}</b><br>Precision in top 5%: %{y:.4f}<extra></extra>' },
          ]}
          layout={{
            barmode: 'group', margin: { b: 110 }, yaxis: { title: { text: 'Score' }, rangemode: 'tozero' },
            xaxis: { tickangle: 0, automargin: true },
            shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0.044445246777629344, y1: 0.044445246777629344, line: { dash: 'dash', color: '#555', width: 1 } }],
            annotations: [{ xref: 'paper', x: 1, y: 0.0444, text: 'Prevalence 4.44%', showarrow: false, xanchor: 'right', yanchor: 'bottom', font: { size: 11 } }],
            legend: { orientation: 'h', y: 1.1 },
          }}
        />
      )}
    </FigureFrame>
  );
}

export function Table5_1() {
  const s = useCsvs({ d: 'chart_data/report_table_5_1/model_comparison.csv' });
  return (
    <FigureFrame
      kind="Table"
      label="Table 5.1"
      caption="Enhanced chronological model comparison (test years 2022–2024; n = 27,697)."
      itemId="report_table_5_1"
      page={29}
      downloads={[{ label: 'model_comparison.csv', path: 'chart_data/report_table_5_1/model_comparison.csv' }]}
    >
      {!s.data ? <Loading state={s} /> : (
        <DataTable rows={s.data.d} columns={[
          { key: 'model', label: 'Model' },
          { key: 'average_precision', label: 'Avg. precision', align: 'right', format: (v, r) => (r.model === 'Majority-class baseline' ? <span title="Exact prevalence 0.044445…; the report prints 0.0445">0.0445*</span> : fmtFixed(v, 4)) },
          { key: 'roc_auc', label: 'ROC–AUC', align: 'right', format: (v) => fmtFixed(v, 4) },
          { key: 'balanced_accuracy_at_0.50', label: 'Balanced accuracy†', align: 'right', format: (v, r) => fmtFixed(v, r.model === 'Majority-class baseline' ? 3 : 4) },
          { key: 'brier_score_uncalibrated', label: 'Brier score', align: 'right', format: (v) => fmtFixed(v, 4) },
        ]} footnote={<>
          †At the illustrative fixed 0.50 threshold. Class weighting means this threshold has not been established as a decision threshold. Brier scores are uncalibrated and should not be interpreted as calibrated individual probabilities.
          <br />*Rounding note: the report prints the baseline as 0.0445. The exact test prevalence is 0.04444… (1,231 of 27,697), which rounds to 0.0444; the report’s printed value is shown.
        </>} />
      )}
    </FigureFrame>
  );
}

export function Figure5_2() {
  const s = useCsvs({ d: 'chart_data/report_figure_5_2/cluster_size.csv', cand: 'models/exploratory_kmeans/candidate_diagnostics.csv' });
  const d = s.data?.d ?? [];
  return (
    <FigureFrame
      label="Figure 5.2"
      caption="Size of the four exploratory crash archetypes. Severity was measured after clustering and was not used to create the groups."
      itemId="report_figure_5_2"
      page={31}
      downloads={[
        { label: 'cluster_size.csv', path: 'chart_data/report_figure_5_2/cluster_size.csv' },
        { label: 'candidate_diagnostics.csv', path: 'models/exploratory_kmeans/candidate_diagnostics.csv' },
      ]}
      dataView={s.data && (
        <>
          <DataTable rows={d} columns={[
            { key: 'CRASH_ARCHETYPE', label: 'Archetype (arbitrary label)' },
            { key: 'crash_records', label: 'Records', align: 'right', format: fmtInt },
            { key: 'serious_fatal_percent', label: 'Serious/fatal % (known)', align: 'right', format: (v) => fmtFixed(v, 2) },
            { key: 'top_COLLISION_LABEL', label: 'Most common collision' },
            { key: 'top_ILLUMINATION_LABEL', label: 'Most common illumination' },
            { key: 'top_TIME_PERIOD', label: 'Most common time period' },
          ]} />
          <p className="mb-2 mt-4 font-semibold">Candidate cluster counts (sampled silhouette; gate ≥ 0.10)</p>
          <DataTable rows={s.data.cand} columns={[
            { key: 'candidate_clusters', label: 'k', align: 'right' },
            { key: 'sampled_silhouette_score', label: 'Silhouette', align: 'right', format: (v) => fmtFixed(v, 4) },
            { key: 'fit_records', label: 'Fit records', align: 'right', format: fmtInt },
            { key: 'evaluation_sample_records', label: 'Evaluation sample', align: 'right', format: fmtInt },
          ]} />
        </>
      )}
      notes="Cluster numbers are arbitrary labels. Hover a bar for the profile measured after clustering."
    >
      {!s.data ? <Loading state={s} /> : (
        <Plot
          ariaLabel="Bar chart of four exploratory archetype sizes; the largest has 38,811 records and the smallest 17,472."
          height={340}
          data={[{
            type: 'bar', x: d.map((r) => `Archetype ${r.CRASH_ARCHETYPE}`), y: col(d, 'crash_records') as number[], marker: { color: '#4c72b0' },
            customdata: d.map((r) => [r.serious_fatal_percent, r.top_COLLISION_LABEL, r.top_ILLUMINATION_LABEL, r.top_TIME_PERIOD]),
            hovertemplate: '<b>%{x}</b>: %{y:,} records<br>Serious/fatal %{customdata[0]:.2f}% of known severity<br>%{customdata[1]} · %{customdata[2]} · %{customdata[3]}<extra></extra>',
          }]}
          layout={{ yaxis: { title: { text: 'Crash records (2016–2023)' } } }}
        />
      )}
    </FigureFrame>
  );
}

/** Table F.1 plus a linked chart: pick a model to see the queue trade-off. */
export function TableF_1() {
  const s = useCsvs({ d: 'chart_data/report_table_f_1/review_queues.csv' });
  const [model, setModel] = useState<string>('all');
  const rows = s.data?.d ?? [];
  const models = [...new Set(rows.map((r) => String(r.model)))];
  const shown = model === 'all' ? rows : rows.filter((r) => r.model === model);
  return (
    <FigureFrame
      kind="Table"
      label="Table F.1"
      caption="Number and share of serious/fatal cases among highest-scored test records."
      itemId="report_table_f_1"
      page={43}
      exploring={model !== 'all'}
      onReset={() => setModel('all')}
      controls={
        <label className="flex items-center gap-2 text-sm">
          Model
          <select className="input py-1" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="all">All models (report)</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      }
      downloads={[{ label: 'review_queues.csv', path: 'chart_data/report_table_f_1/review_queues.csv' }]}
    >
      {!s.data ? <Loading state={s} /> : (
        <>
          <Plot
            ariaLabel="Precision and recall at top 5, 10 and 20 percent review queues by model."
            height={320}
            data={[...new Set(shown.map((r) => String(r.model)))].flatMap((m) => {
              const rr = shown.filter((r) => r.model === m);
              return [
                { type: 'scatter', mode: 'lines+markers', name: `${m} — precision`, x: rr.map((r) => `Top ${r.top_percent_flagged}%`), y: col(rr, 'precision_percent') as number[],
                  line: { color: MODEL_COLOURS[m] }, customdata: rr.map((r) => [r.serious_fatal_found, r.records_flagged]),
                  hovertemplate: `${m}<br>%{x}: precision %{y:.2f}%<br>%{customdata[0]:,} found of %{customdata[1]:,} flagged<extra></extra>` },
                { type: 'scatter', mode: 'lines+markers', name: `${m} — recall`, x: rr.map((r) => `Top ${r.top_percent_flagged}%`), y: col(rr, 'recall_percent') as number[],
                  line: { color: MODEL_COLOURS[m], dash: 'dot' }, hovertemplate: `${m}<br>%{x}: recall %{y:.2f}% of 1,231<extra></extra>` },
              ] as Data[];
            })}
            layout={{ yaxis: { title: { text: 'Percent' } }, legend: { orientation: 'h', y: -0.25, font: { size: 11 } }, margin: { b: 110 } }}
          />
          <DataTable rows={shown} columns={[
            { key: 'model', label: 'Model' },
            { key: 'top_percent_flagged', label: 'Top fraction', format: (v) => `${v}%` },
            { key: 'records_flagged', label: 'Flagged n', align: 'right', format: fmtInt },
            { key: 'serious_fatal_found', label: 'Found n', align: 'right', format: fmtInt },
            { key: 'precision_percent', label: 'Precision %', align: 'right', format: (v) => fmtFixed(v, 2) },
            { key: 'recall_percent', label: 'Recall %', align: 'right', format: (v) => fmtFixed(v, 2) },
          ]} footnote="Queues use ceil(n × fraction) of 27,697 test records ranked by score; 1,231 serious/fatal outcomes in the test period. Retrospective evaluation, not a recommended operational cutoff." />
        </>
      )}
    </FigureFrame>
  );
}

// ---------------------------------------------------------------------------------
// Supplementary model diagnostics (not report figures)
// ---------------------------------------------------------------------------------

interface Curves { note: string; curves: Record<string, { roc: { x: number[]; y: number[]; source_points: number }; pr: { x: number[]; y: number[]; source_points: number } }> }
const CURVE_NAMES: Record<string, string> = {
  logistic_regression_plus_collision: 'Logistic Regression + collision',
  random_forest_plus_collision: 'Random Forest + collision',
  random_forest_without_collision: 'Random Forest without collision',
  histgradientboosting_plus_collision: 'HistGradientBoosting + collision',
  temporally_calibrated_logistic: 'Temporally calibrated logistic',
  benchmark_random_forest: 'Benchmark Random Forest (2004–2021)',
};

export function CurvesFigure() {
  const c = useJson<Curves>('derived/curves.json');
  const [kind, setKind] = useState<'roc' | 'pr'>('pr');
  const enhanced = ['logistic_regression_plus_collision', 'random_forest_plus_collision', 'random_forest_without_collision', 'histgradientboosting_plus_collision', 'temporally_calibrated_logistic'];
  return (
    <FigureFrame
      label="Supplementary diagnostic"
      caption="Precision–recall and ROC curves for the enhanced models on the 2022–2024 test period (n = 27,697). Not a report figure."
      itemId="supplementary_temporal_evaluation"
      controls={<Segmented label="Curve" value={kind} onChange={setKind} options={[{ value: 'pr', label: 'Precision–recall' }, { value: 'roc', label: 'ROC' }]} />}
      downloads={enhanced.flatMap((m) => [
        { label: `${m}_roc.csv`, path: `model_evaluation/${m}_roc.csv` },
        { label: `${m}_precision_recall.csv`, path: `model_evaluation/${m}_precision_recall.csv` },
      ])}
      notes={c.data && <>Curves are drawn from saved evaluation arrays; for display, intermediate points are omitted (never altered) to at most 1,500 per curve — full-resolution CSVs are downloadable. Click legend entries to toggle models.</>}
    >
      {!c.data ? <Loading state={c} /> : (
        <Plot
          ariaLabel={kind === 'pr' ? 'Precision-recall curves for five models with prevalence reference.' : 'ROC curves for five models with chance diagonal.'}
          height={440}
          data={[
            ...enhanced.filter((m) => c.data!.curves[m]).map((m) => ({
              type: 'scatter', mode: 'lines', name: CURVE_NAMES[m], line: { color: MODEL_COLOURS[CURVE_NAMES[m]], width: 2 },
              x: c.data!.curves[m][kind].x, y: c.data!.curves[m][kind].y,
              hovertemplate: kind === 'pr' ? `${CURVE_NAMES[m]}<br>Recall %{x:.3f}, precision %{y:.3f}<extra></extra>` : `${CURVE_NAMES[m]}<br>FPR %{x:.3f}, TPR %{y:.3f}<extra></extra>`,
            }) as Data),
            kind === 'pr'
              ? { type: 'scatter', mode: 'lines', name: 'Prevalence 4.44%', x: [0, 1], y: [0.044445246777629344, 0.044445246777629344], line: { dash: 'dash', color: '#777', width: 1 }, hoverinfo: 'skip' }
              : { type: 'scatter', mode: 'lines', name: 'Chance', x: [0, 1], y: [0, 1], line: { dash: 'dash', color: '#777', width: 1 }, hoverinfo: 'skip' },
          ]}
          layout={{
            xaxis: { type: 'linear', title: { text: kind === 'pr' ? 'Recall' : 'False positive rate' }, range: [0, 1] },
            yaxis: { type: 'linear', title: { text: kind === 'pr' ? 'Precision' : 'True positive rate' }, range: [0, kind === 'pr' ? 0.6 : 1] },
            legend: { orientation: 'h', y: -0.2 }, margin: { b: 100 },
          }}
        />
      )}
    </FigureFrame>
  );
}

export function UncertaintyFigure() {
  const s = useCsvs({ ci: 'model_evaluation/temporal_ap_intervals.csv', m: 'chart_data/report_table_5_1/model_comparison.csv' });
  const d = s.data;
  const rows: Row[] = d ? d.ci.map((r) => ({ ...r, ap: d.m.find((x) => x.model === r.model)?.average_precision ?? null })) : [];
  return (
    <FigureFrame
      label="Supplementary diagnostic"
      caption="Average precision with 95% month-block bootstrap intervals (300 year-month block replicates), test years 2022–2024. Not a report figure."
      itemId="supplementary_temporal_evaluation"
      downloads={[{ label: 'temporal_ap_intervals.csv', path: 'model_evaluation/temporal_ap_intervals.csv' }]}
      notes="Year-month blocks, not individual crash rows, were resampled (empirical 2.5/97.5 percentiles). Overlapping intervals among the collision-type models mean their ordering by AP is not firmly established."
      dataView={d && (
        <DataTable rows={rows} columns={[
          { key: 'model', label: 'Model' },
          { key: 'ap', label: 'AP (point)', align: 'right', format: (v) => fmtFixed(v, 4) },
          { key: 'ap_2_5_percentile', label: '2.5th pct', align: 'right', format: (v) => fmtFixed(v, 4) },
          { key: 'ap_97_5_percentile', label: '97.5th pct', align: 'right', format: (v) => fmtFixed(v, 4) },
          { key: 'valid_block_replicates', label: 'Replicates', align: 'right' },
        ]} />
      )}
    >
      {!d ? <Loading state={s} /> : (
        <Plot
          ariaLabel="Dot and interval chart of average precision with bootstrap intervals by model."
          height={300}
          data={[{
            type: 'scatter', mode: 'markers', y: rows.map((r) => String(r.model)), x: rows.map((r) => num(r.ap)), marker: { size: 10, color: '#4c72b0' },
            error_x: { type: 'data', symmetric: false, array: rows.map((r) => num(r.ap_97_5_percentile) - num(r.ap)), arrayminus: rows.map((r) => num(r.ap) - num(r.ap_2_5_percentile)) },
            customdata: rows.map((r) => [r.ap_2_5_percentile, r.ap_97_5_percentile]),
            hovertemplate: '<b>%{y}</b><br>AP %{x:.4f}<br>95% block interval %{customdata[0]:.4f}–%{customdata[1]:.4f}<extra></extra>',
          }]}
          layout={{ margin: { l: 230 }, xaxis: { type: 'linear', title: { text: 'Average precision' }, tickformat: '.3f' }, yaxis: { type: 'category' } }}
        />
      )}
    </FigureFrame>
  );
}

export function CalibrationFigure() {
  const s = useCsvs({ b: 'model_evaluation/calibration_bin_counts.csv' });
  const d = s.data?.b ?? [];
  return (
    <FigureFrame
      label="Supplementary diagnostic"
      caption="Reliability of the temporally calibrated logistic model on the 2022–2024 test period: mean predicted probability vs observed serious/fatal rate in 10 quantile bins. Not a report figure."
      itemId="supplementary_temporal_evaluation"
      downloads={[{ label: 'calibration_bin_counts.csv', path: 'model_evaluation/calibration_bin_counts.csv' }]}
      notes="Calibration fit years strictly precede each validation year. Points near the diagonal indicate agreement in these bins only; this is not evidence of calibration for new periods or places."
      dataView={s.data && (
        <DataTable rows={d} columns={[
          { key: 'bin_id', label: 'Bin' },
          { key: 'lower_edge', label: 'Lower edge', align: 'right', format: (v) => fmtFixed(v, 4) },
          { key: 'upper_edge', label: 'Upper edge', align: 'right', format: (v) => fmtFixed(v, 4) },
          { key: 'records', label: 'Records', align: 'right', format: fmtInt },
          { key: 'serious_fatal', label: 'Serious/fatal', align: 'right', format: fmtInt },
          { key: 'mean_probability', label: 'Mean predicted', align: 'right', format: (v) => fmtFixed(v, 4) },
          { key: 'observed_rate', label: 'Observed rate', align: 'right', format: (v) => fmtFixed(v, 4) },
        ]} />
      )}
    >
      {!s.data ? <Loading state={s} /> : (
        <Plot
          ariaLabel="Reliability diagram with ten bins close to the diagonal."
          height={380}
          data={[
            { type: 'scatter', mode: 'lines+markers', name: 'Calibrated logistic', x: col(d, 'mean_probability') as number[], y: col(d, 'observed_rate') as number[],
              marker: { color: '#8172b3', size: 8 }, customdata: d.map((r) => [r.records, r.serious_fatal]),
              hovertemplate: 'Mean predicted %{x:.4f}<br>Observed %{y:.4f}<br>%{customdata[1]:,} events in %{customdata[0]:,} records<extra></extra>' },
            { type: 'scatter', mode: 'lines', name: 'Perfect calibration', x: [0, 0.15], y: [0, 0.15], line: { dash: 'dash', color: '#777' }, hoverinfo: 'skip' },
          ]}
          layout={{ xaxis: { type: 'linear', title: { text: 'Mean predicted probability' }, tickformat: '.2f' }, yaxis: { type: 'linear', title: { text: 'Observed serious/fatal rate' }, tickformat: '.2f' }, legend: { orientation: 'h', y: -0.2 } }}
        />
      )}
    </FigureFrame>
  );
}

export function PermutationFigure() {
  const s = useCsvs({ d: 'model_evaluation/permutation_importance.csv' });
  const d = s.data ? [...s.data.d].reverse() : [];
  return (
    <FigureFrame
      label="Supplementary diagnostic"
      caption="Permutation importance (mean drop in average precision when a source feature is shuffled) on the test period, as exported from the v6 run. Not a report figure."
      itemId="supplementary_enhanced_models"
      downloads={[{ label: 'permutation_importance.csv', path: 'model_evaluation/permutation_importance.csv' }]}
      notes="Negative or near-zero values mean shuffling did not reduce AP beyond noise. Collision type dominates, consistent with the report’s ablation, and it is recorded after the crash."
    >
      {!s.data ? <Loading state={s} /> : (
        <Plot
          ariaLabel="Horizontal bars of permutation importance; COLLISION_LABEL about 0.104, others near zero."
          height={300}
          data={[{
            type: 'bar', orientation: 'h', y: col(d, 'source_feature') as string[], x: col(d, 'mean_average_precision_drop') as number[], marker: { color: '#4c72b0' },
            error_x: { type: 'data', array: col(d, 'std_average_precision_drop') as number[] },
            hovertemplate: '<b>%{y}</b><br>Mean AP drop %{x:.4f}<extra></extra>',
          }]}
          layout={{ margin: { l: 170 }, xaxis: { type: 'linear', title: { text: 'Mean drop in average precision (± SD over repeats)' }, tickformat: '.3f' }, yaxis: { type: 'category' } }}
        />
      )}
    </FigureFrame>
  );
}

export function ConfusionTables() {
  const ids = Object.entries(MODEL_IDS);
  const paths = Object.fromEntries(ids.map(([, id]) => [id, `model_evaluation/${id}_confusion_matrix.csv`]));
  const s = useCsvs(paths);
  return !s.data ? <Loading state={s} /> : (
    <div className="grid gap-4 md:grid-cols-2">
      {ids.map(([name, id]) => (
        <div key={id}>
          <p className="mb-1 text-sm font-semibold">{name}</p>
          <DataTable rows={s.data![id]} columns={[
            { key: 'true_label', label: 'True label' },
            { key: 'predicted_other', label: 'Predicted other', align: 'right', format: fmtInt },
            { key: 'predicted_serious_fatal', label: 'Predicted serious/fatal', align: 'right', format: fmtInt },
          ]} />
        </div>
      ))}
      <p className="text-xs text-ink-faint md:col-span-2">At the illustrative 0.50 threshold on 27,697 test records. Not a decision threshold.</p>
    </div>
  );
}
