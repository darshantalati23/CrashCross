import { ReactNode, useState } from 'react';
import type { Data } from 'plotly.js';
import { FigureFrame } from '../components/FigureFrame';
import { Plot, PALETTE, useWidth } from '../components/Plot';
import { DataTable, ErrorNote, Segmented, Spinner } from '../components/ui';
import { Row, fmtFixed, fmtInt, fmtQ, useCsvs } from '../lib/data';

// ---------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------

const num = (v: unknown) => (v === null || v === undefined ? NaN : Number(v));
const col = (rows: Row[], k: string) => rows.map((r) => r[k]);

export function Loading({ state }: { state: { loading: boolean; error: string | null } }) {
  if (state.error) return <ErrorNote>Could not load the exported data for this item: {state.error}</ErrorNote>;
  return <Spinner label="Loading exported data…" />;
}

function PanelGrid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid gap-4 ${cols === 3 ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'}`}>{children}</div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h4 className="px-2 text-center text-sm font-semibold text-ink-soft">{title}</h4>
      {children}
    </div>
  );
}

/** Turn a statsmodels term such as C(COLLISION_LABEL, Treatment(reference='Angle'))[T.Pedestrian] into readable text. */
export function termLabel(term: string): { label: string; family: string } {
  const m = term.match(/^C\((\w+), Treatment\(reference='([^']*)'\)\)\[T\.(.*)\]$/);
  const names: Record<string, string> = {
    COLLISION_LABEL: 'Collision',
    ILLUMINATION_LABEL: 'Illumination',
    TIME_PERIOD: 'Time period',
    INTERSECTION_LABEL: 'Intersection',
    CRASH_MONTH: 'Month',
  };
  if (m) return { label: `${m[3]} vs ${m[2]}`, family: names[m[1]] ?? m[1] };
  const y = term.match(/^C\(CRASH_YEAR\)\[T\.(\d+)\]$/);
  if (y) return { label: `${y[1]} vs 2016`, family: 'Year (default first-level reference)' };
  if (term === 'SPEED_LIMIT_VALID') return { label: 'Speed limit (per 1 mph)', family: 'Numeric' };
  return { label: term, family: 'Other' };
}

const binaryGroup = (label: string) =>
  ['Fatal', 'Serious injury'].includes(label)
    ? 'Serious/fatal (codes 1–2)'
    : ['Property damage only', 'Possible injury', 'Minor injury'].includes(label)
      ? 'Other known severity (codes 0, 3, 4)'
      : 'Unknown — excluded from binary outcome';

// ---------------------------------------------------------------------------------
// Chapter 2
// ---------------------------------------------------------------------------------

export function Figure2_1() {
  const s = useCsvs({ d: 'chart_data/report_figure_2_1/missing_top20.csv' });
  const [metric, setMetric] = useState<'pct' | 'n'>('pct');
  return (
    <FigureFrame
      label="Figure 2.1"
      caption="Twenty source fields with the highest missing-record percentages. Several specialised work-zone fields are rarely recorded; missingness is a property of the extract, not evidence that the corresponding event did not occur."
      itemId="report_figure_2_1"
      page={15}
      exploring={metric !== 'pct'}
      onReset={() => setMetric('pct')}
      controls={
        <Segmented label="Measure" value={metric} onChange={setMetric}
          options={[{ value: 'pct', label: 'Missing %' }, { value: 'n', label: 'Missing records' }]} />
      }
      downloads={[{ label: 'missing_top20.csv', path: 'chart_data/report_figure_2_1/missing_top20.csv' }]}
      dataView={s.data && (
        <DataTable rows={s.data.d} maxHeight={320} columns={[
          { key: 'index_0', label: 'Field' },
          { key: 'missing_count', label: 'Missing records', align: 'right', format: fmtInt },
          { key: 'missing_percent', label: 'Missing %', align: 'right', format: (v) => fmtFixed(v, 2) },
        ]} />
      )}
    >
      {!s.data ? <Loading state={s} /> : (
        <Plot
          ariaLabel="Horizontal bar chart of the twenty source fields with the highest missing percentages; SPEC_JURIS_CD is highest at 99.41%."
          height={560}
          data={[{
            type: 'bar', orientation: 'h',
            y: col(s.data.d, 'index_0') as string[],
            x: col(s.data.d, metric === 'pct' ? 'missing_percent' : 'missing_count') as number[],
            customdata: s.data.d.map((r) => [r.missing_count, r.missing_percent]),
            marker: { color: PALETTE.primary },
            hovertemplate: '<b>%{y}</b><br>Missing records: %{customdata[0]:,}<br>Missing: %{customdata[1]:.2f}% of 248,810<extra></extra>',
          }]}
          layout={{
            margin: { l: 150 },
            xaxis: { title: { text: metric === 'pct' ? 'Missing records (%)' : 'Missing records' }, range: metric === 'pct' ? [0, 100] : undefined },
          }}
        />
      )}
    </FigureFrame>
  );
}

export function Figure2_2() {
  const s = useCsvs({ d: 'chart_data/report_figure_2_2/missing_percent_by_year.csv' });
  const years = Array.from({ length: 21 }, (_, i) => String(2004 + i));
  return (
    <FigureFrame
      label="Figure 2.2"
      caption="Selected field availability by year. The strong year pattern shows why one pooled missingness percentage can conceal structural changes in recording."
      itemId="report_figure_2_2"
      page={15}
      downloads={[{ label: 'missing_percent_by_year.csv', path: 'chart_data/report_figure_2_2/missing_percent_by_year.csv' }]}
      dataView={s.data && (
        <DataTable rows={s.data.d} columns={[
          { key: 'index_0', label: 'Field' },
          ...years.map((y) => ({ key: y, label: y, align: 'right' as const, format: (v: unknown) => fmtFixed(v as number, 2) })),
        ]} />
      )}
    >
      {!s.data ? <Loading state={s} /> : (
        <Plot
          ariaLabel="Heatmap of missing percentage by field and year; HOUR_OF_DAY is 96.18% missing and ILLUMINATION 100% missing in 2024."
          height={420}
          data={[{
            type: 'heatmap',
            x: years,
            y: col(s.data.d, 'index_0') as string[],
            z: s.data.d.map((r) => years.map((y) => num(r[y]))),
            zmin: 0, zmax: 100,
            colorscale: 'Magma', reversescale: true,
            colorbar: { title: { text: 'Missing %' } },
            hovertemplate: '<b>%{y}</b>, %{x}<br>Missing: %{z:.2f}%<extra></extra>',
            xgap: 1, ygap: 1,
          }]}
          layout={{ margin: { l: 140 }, xaxis: { title: { text: 'Crash year' }, tickangle: -45, type: 'category' }, yaxis: { autorange: 'reversed' } }}
        />
      )}
    </FigureFrame>
  );
}

// ---------------------------------------------------------------------------------
// Chapter 3
// ---------------------------------------------------------------------------------

export function Figure3_1() {
  const s = useCsvs({ d: 'chart_data/report_figure_3_1/severity_counts.csv' });
  const [colour, setColour] = useState<'report' | 'binary'>('report');
  const rows = s.data ? [...s.data.d].reverse() : [];
  const groups = ['Serious/fatal (codes 1–2)', 'Other known severity (codes 0, 3, 4)', 'Unknown — excluded from binary outcome'];
  const gColour = [PALETTE.red, PALETTE.primary, PALETTE.muted];
  const traces: Data[] =
    colour === 'report'
      ? [{
          type: 'bar', orientation: 'h', y: col(rows, 'SEVERITY_LABEL') as string[], x: col(rows, 'count') as number[],
          marker: { color: PALETTE.primary },
          customdata: rows.map((r) => [binaryGroup(String(r.SEVERITY_LABEL)), (100 * num(r.count)) / 248810]),
          hovertemplate: '<b>%{y}</b><br>%{x:,} records (%{customdata[1]:.2f}% of 248,810)<br>%{customdata[0]}<extra></extra>',
        }]
      : groups.map((g, i) => {
          const sub = rows.filter((r) => binaryGroup(String(r.SEVERITY_LABEL)) === g);
          return {
            type: 'bar', orientation: 'h', name: g, y: col(sub, 'SEVERITY_LABEL') as string[], x: col(sub, 'count') as number[],
            marker: { color: gColour[i] },
            hovertemplate: `<b>%{y}</b><br>%{x:,} records<br>${g}<extra></extra>`,
          } as Data;
        });
  return (
    <FigureFrame
      label="Figure 3.1"
      caption="Distribution of the source severity labels in the 2004–2024 extract. The long bar for property-damage-only records and the much smaller serious/fatal groups explain why accuracy alone is a weak model measure."
      itemId="report_figure_3_1"
      page={17}
      exploring={colour !== 'report'}
      onReset={() => setColour('report')}
      controls={
        <Segmented label="Colouring" value={colour} onChange={setColour}
          options={[{ value: 'report', label: 'Single colour (report)' }, { value: 'binary', label: 'Colour by binary-outcome group' }]} />
      }
      downloads={[{ label: 'severity_counts.csv', path: 'chart_data/report_figure_3_1/severity_counts.csv' }]}
      dataView={s.data && (
        <DataTable rows={s.data.d} columns={[
          { key: 'SEVERITY_LABEL', label: 'Source severity label' },
          { key: 'count', label: 'Crash records', align: 'right', format: fmtInt },
          { key: 'SEVERITY_LABEL', label: 'Binary-outcome group', format: (v) => binaryGroup(String(v)) },
        ]} footnote="Total 248,810 records; 205,544 (82.61%) fall in the known 0–4 set used for the binary outcome." />
      )}
    >
      {!s.data ? <Loading state={s} /> : (
        <Plot
          ariaLabel="Horizontal bar chart of source severity labels; property damage only 128,621, fatal 1,396."
          height={360}
          data={traces}
          layout={{ margin: { l: 170 }, barmode: 'stack', showlegend: colour === 'binary', xaxis: { title: { text: 'Crash records' } } }}
        />
      )}
    </FigureFrame>
  );
}

export function Figure3_2() {
  const s = useCsvs({
    annual: 'chart_data/report_figure_3_2/annual.csv',
    monthly: 'chart_data/report_figure_3_2/monthly.csv',
    weekday: 'chart_data/report_figure_3_2/weekday.csv',
    hour: 'chart_data/report_figure_3_2/hour.csv',
  });
  const d = s.data;
  const bar = (rows: Row[], x: string, y: string, xl: string): Data => ({
    type: 'bar', x: rows.map((r) => String(Math.round(num(r[x])))), y: col(rows, y) as number[], marker: { color: '#4c72b0' },
    hovertemplate: `${xl} %{x}<br>%{y:,} records<extra></extra>`,
  });
  const small = { margin: { t: 10, l: 56, r: 10, b: 46 } };
  return (
    <FigureFrame
      label="Figure 3.2"
      caption="Annual, monthly, weekday and recorded-hour counts. These are totals in the source file and should not be read as traffic-normalised rates."
      itemId="report_figure_3_2"
      page={18}
      downloads={[
        { label: 'annual.csv', path: 'chart_data/report_figure_3_2/annual.csv' },
        { label: 'monthly.csv', path: 'chart_data/report_figure_3_2/monthly.csv' },
        { label: 'weekday.csv', path: 'chart_data/report_figure_3_2/weekday.csv' },
        { label: 'hour.csv', path: 'chart_data/report_figure_3_2/hour.csv' },
      ]}
      notes="The day-of-week panel keeps the recorded source day codes (1–7), as in the notebook; no weekday-name mapping was asserted. The hour panel uses valid recorded hours only (2024 has 387 valid hours of 10,228 records)."
    >
      {!d ? <Loading state={s} /> : (
        <PanelGrid>
          <Panel title="Crash records by year">
            <Plot ariaLabel="Line chart of crash records by year, 2004–2024, lowest 9,863 in 2020 and highest 12,908 in 2016." height={280}
              data={[{ type: 'scatter', mode: 'lines+markers', x: col(d.annual, 'CRASH_YEAR') as number[], y: col(d.annual, 'value') as number[],
                line: { color: '#4c72b0' }, hovertemplate: '%{x}: %{y:,} records<extra></extra>' }]}
              layout={{ ...small, xaxis: { title: { text: 'Year' }, dtick: 2 }, yaxis: { title: { text: 'Records' } } }} />
          </Panel>
          <Panel title="Crash records by month">
            <Plot ariaLabel="Bar chart of crash records by month." height={280} data={[bar(d.monthly, 'CRASH_MONTH', 'count', 'Month')]}
              layout={{ ...small, xaxis: { title: { text: 'Month' }, type: 'category' }, yaxis: { title: { text: 'Records' } } }} />
          </Panel>
          <Panel title="Crash records by day-of-week code">
            <Plot ariaLabel="Bar chart of crash records by recorded day code 1 to 7." height={280} data={[bar(d.weekday, 'DAY_OF_WEEK', 'count', 'Day code')]}
              layout={{ ...small, xaxis: { title: { text: 'Recorded day code' }, type: 'category' }, yaxis: { title: { text: 'Records' } } }} />
          </Panel>
          <Panel title="Crash records by hour">
            <Plot ariaLabel="Bar chart of crash records by valid recorded hour of day, peaking in the late afternoon." height={280} data={[bar(d.hour, 'HOUR_VALID', 'count', 'Hour')]}
              layout={{ ...small, xaxis: { title: { text: 'Hour of day' }, type: 'category' }, yaxis: { title: { text: 'Records' } } }} />
          </Panel>
        </PanelGrid>
      )}
    </FigureFrame>
  );
}

export function Figure3_3() {
  const s = useCsvs({ fatal: 'chart_data/report_figure_3_3/fatal.csv', sf: 'chart_data/report_figure_3_3/serious_fatal.csv' });
  const d = s.data;
  const small = { margin: { t: 10, l: 56, r: 10, b: 46 } };
  return (
    <FigureFrame
      label="Figure 3.3"
      caption="Fatal-share and post-2016 serious/fatal-share trends, alongside a marked severity-standard boundary. Pre-2016 serious/fatal shares are intentionally not plotted as comparable values."
      itemId="report_figure_3_3"
      page={18}
      downloads={[
        { label: 'fatal.csv', path: 'chart_data/report_figure_3_3/fatal.csv' },
        { label: 'serious_fatal.csv', path: 'chart_data/report_figure_3_3/serious_fatal.csv' },
      ]}
      dataView={d && (
        <PanelGrid>
          <DataTable rows={d.fatal} maxHeight={300} columns={[
            { key: 'CRASH_YEAR', label: 'Year' },
            { key: 'fatal_records', label: 'Fatal', align: 'right', format: fmtInt },
            { key: 'known_severity_records', label: 'Known severity', align: 'right', format: fmtInt },
            { key: 'fatal_percent_of_known', label: 'Fatal %', align: 'right', format: (v) => fmtFixed(v, 2) },
          ]} />
          <DataTable rows={d.sf} columns={[
            { key: 'CRASH_YEAR', label: 'Year' },
            { key: 'serious_fatal_records', label: 'Serious/fatal', align: 'right', format: fmtInt },
            { key: 'known_severity_records', label: 'Known severity', align: 'right', format: fmtInt },
            { key: 'serious_fatal_percent_of_known', label: 'Serious/fatal %', align: 'right', format: (v) => fmtFixed(v, 2) },
          ]} />
        </PanelGrid>
      )}
    >
      {!d ? <Loading state={s} /> : (
        <PanelGrid>
          <Panel title="Fatal crashes as a share of known-severity crashes">
            <Plot ariaLabel="Line chart of fatal share of known-severity crashes 2004–2024 with a dashed line at the 2016 severity-standard change." height={300}
              data={[{ type: 'scatter', mode: 'lines+markers', name: 'Fatal share', x: col(d.fatal, 'CRASH_YEAR') as number[], y: col(d.fatal, 'fatal_percent_of_known') as number[],
                line: { color: '#4c72b0' }, customdata: d.fatal.map((r) => [r.fatal_records, r.known_severity_records]),
                hovertemplate: '%{x}: %{y:.2f}%<br>%{customdata[0]:,} fatal of %{customdata[1]:,} known-severity<extra></extra>' }]}
              layout={{ ...small, showlegend: false, xaxis: { title: { text: 'Crash year' }, dtick: 2 }, yaxis: { title: { text: 'Percent' } },
                shapes: [{ type: 'line', x0: 2016, x1: 2016, yref: 'paper', y0: 0, y1: 1, line: { color: PALETTE.red, dash: 'dash', width: 1.5 } }],
                annotations: [{ x: 2016, yref: 'paper', y: 1, text: 'Severity standard changed', showarrow: false, xanchor: 'left', font: { size: 11, color: PALETTE.red } }] }} />
          </Panel>
          <Panel title="Serious/fatal share under the post-2016 standard">
            <Plot ariaLabel="Line chart of serious/fatal share of known-severity crashes from 2016 to 2024." height={300}
              data={[{ type: 'scatter', mode: 'lines+markers', x: col(d.sf, 'CRASH_YEAR') as number[], y: col(d.sf, 'serious_fatal_percent_of_known') as number[],
                line: { color: '#dd8452' }, customdata: d.sf.map((r) => [r.serious_fatal_records, r.known_severity_records]),
                hovertemplate: '%{x}: %{y:.2f}%<br>%{customdata[0]:,} serious/fatal of %{customdata[1]:,} known-severity<extra></extra>' }]}
              layout={{ ...small, xaxis: { title: { text: 'Crash year' }, dtick: 1 }, yaxis: { title: { text: 'Percent' } } }} />
          </Panel>
        </PanelGrid>
      )}
    </FigureFrame>
  );
}

export function Figure3_4() {
  const s = useCsvs({
    collision: 'chart_data/report_figure_3_4/collision.csv',
    road: 'chart_data/report_figure_3_4/road_relation.csv',
    intersection: 'chart_data/report_figure_3_4/intersection.csv',
    urban: 'chart_data/report_figure_3_4/urban_rural.csv',
  });
  const d = s.data;
  const hbar = (rows: Row[], k: string): Data => {
    const r = [...rows].reverse();
    return { type: 'bar', orientation: 'h', y: r.map((x) => String(x[k])), x: col(r, 'crash_records') as number[], marker: { color: '#4c72b0' },
      hovertemplate: '<b>%{y}</b><br>%{x:,} crash records<extra></extra>' };
  };
  const lay = { margin: { t: 10, l: 150, r: 10, b: 46 }, xaxis: { title: { text: 'Crash records' } } };
  return (
    <FigureFrame
      label="Figure 3.4"
      caption="Recorded collision and roadway context distributions. Category codes are interpreted only where their source labels are supported; urban/rural remains a source-coded field."
      itemId="report_figure_3_4"
      page={19}
      downloads={[
        { label: 'collision.csv', path: 'chart_data/report_figure_3_4/collision.csv' },
        { label: 'road_relation.csv', path: 'chart_data/report_figure_3_4/road_relation.csv' },
        { label: 'intersection.csv', path: 'chart_data/report_figure_3_4/intersection.csv' },
        { label: 'urban_rural.csv', path: 'chart_data/report_figure_3_4/urban_rural.csv' },
      ]}
      notes="Each panel shows up to the 12 most frequent recorded values, all years 2004–2024, unknown categories retained."
    >
      {!d ? <Loading state={s} /> : (
        <PanelGrid>
          <Panel title="Collision type"><Plot ariaLabel="Horizontal bars of collision type counts." height={340} data={[hbar(d.collision, 'COLLISION_LABEL')]} layout={lay} /></Panel>
          <Panel title="Relation to road"><Plot ariaLabel="Horizontal bars of relation-to-road counts." height={340} data={[hbar(d.road, 'ROAD_RELATION_LABEL')]} layout={lay} /></Panel>
          <Panel title="Intersection type"><Plot ariaLabel="Horizontal bars of intersection type counts." height={340} data={[hbar(d.intersection, 'INTERSECTION_LABEL')]} layout={lay} /></Panel>
          <Panel title="Urban/rural source code"><Plot ariaLabel="Horizontal bars of urban/rural source code counts." height={340} data={[hbar(d.urban, 'URBAN_RURAL')]}
            layout={{ ...lay, yaxis: { type: 'category', title: { text: 'Source code (labels not validated)' } } }} /></Panel>
        </PanelGrid>
      )}
    </FigureFrame>
  );
}

export function Figure3_5() {
  const fields = ['PERSON_COUNT', 'VEHICLE_COUNT', 'INJURY_COUNT', 'FATAL_COUNT', 'MAJ_INJ_COUNT', 'PED_COUNT'];
  const paths = Object.fromEntries(fields.map((f) => [f, `chart_data/report_figure_3_5/${f.toLowerCase()}.csv`]));
  const s = useCsvs(paths);
  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  return (
    <FigureFrame
      label="Figure 3.5"
      caption="Crash-level distributions of people, vehicles and injury-related counts. Display bins compress the upper tail for readability; no records are removed from the underlying data."
      itemId="report_figure_3_5"
      page={20}
      exploring={scale !== 'linear'}
      onReset={() => setScale('linear')}
      controls={<Segmented label="Y axis scale" value={scale} onChange={setScale}
        options={[{ value: 'linear', label: 'Linear axis (report)' }, { value: 'log', label: 'Log axis' }]} />}
      downloads={fields.map((f) => ({ label: `${f.toLowerCase()}.csv`, path: paths[f] }))}
      notes="Upper display bin = max(3, min(10, int(99th percentile))); values at or above it are pooled into the “+” bin. Missing values are dropped per field, so panel totals differ."
    >
      {!s.data ? <Loading state={s} /> : (
        <PanelGrid cols={3}>
          {fields.map((f) => (
            <Panel key={f} title={f}>
              <Plot ariaLabel={`Bar chart of crash records by recorded ${f}.`} height={250}
                data={[{ type: 'bar', x: s.data![f].map((r) => String(r[f])), y: col(s.data![f], 'crash_records') as number[], marker: { color: '#4c72b0' },
                  hovertemplate: `${f} = %{x}<br>%{y:,} crash records<extra></extra>` }]}
                layout={{ margin: { t: 6, l: 60, r: 8, b: 40 }, xaxis: { type: 'category', title: { text: 'Recorded count' } }, yaxis: { type: scale, title: { text: 'Crash records' } } }} />
            </Panel>
          ))}
        </PanelGrid>
      )}
    </FigureFrame>
  );
}

export function Figure3_6() {
  const s = useCsvs({
    pearson: 'chart_data/report_figure_3_6/pearson.csv',
    spearman: 'chart_data/report_figure_3_6/spearman.csv',
    n: 'statistical_tables/correlation_pairwise_n.csv',
  });
  const d = s.data;
  const heat = (rows: Row[]): Data => {
    const vars = rows.map((r) => String(r.index_0));
    const z = rows.map((r) => vars.map((v) => num(r[v])));
    const nmat = vars.map((a) => vars.map((b) => d!.n.find((r) => r.index_0 === a)?.[b] ?? null));
    return {
      type: 'heatmap', x: vars, y: vars, z, zmin: -1, zmax: 1, colorscale: 'RdBu',
      text: z.map((r) => r.map((v) => (Number.isFinite(v) ? v.toFixed(2) : ''))) as unknown as string[], texttemplate: '%{text}',
      customdata: nmat as unknown as number[][],
      hovertemplate: '%{y} × %{x}<br>r = %{z:.4f}<br>pairwise n = %{customdata:,}<extra></extra>',
      colorbar: { len: 0.8 },
    } as Data;
  };
  const lay = { margin: { t: 10, l: 130, r: 10, b: 120 }, yaxis: { autorange: 'reversed' as const }, xaxis: { tickangle: -45 } };
  return (
    <FigureFrame
      label="Figure 3.6"
      caption="Pearson and Spearman correlations among selected numerical quantities. Category codes and identifiers are excluded; count relationships remain descriptive."
      itemId="report_figure_3_6"
      page={21}
      downloads={[
        { label: 'pearson.csv', path: 'chart_data/report_figure_3_6/pearson.csv' },
        { label: 'spearman.csv', path: 'chart_data/report_figure_3_6/spearman.csv' },
        { label: 'correlation_pairwise_n.csv', path: 'statistical_tables/correlation_pairwise_n.csv' },
      ]}
      notes="Pairwise-complete observations; hover shows the pairwise n behind each coefficient (speed-limit pairs use fewer records)."
    >
      {!d ? <Loading state={s} /> : (
        <PanelGrid>
          <Panel title="Pearson"><Plot ariaLabel="Pearson correlation heatmap among person, vehicle, unit, injury, fatal counts and speed limit." height={430} data={[heat(d.pearson)]} layout={lay} /></Panel>
          <Panel title="Spearman"><Plot ariaLabel="Spearman correlation heatmap among the same quantities." height={430} data={[heat(d.spearman)]} layout={lay} /></Panel>
        </PanelGrid>
      )}
    </FigureFrame>
  );
}

const SHARE_LABEL = 'Serious/fatal share among known-severity crashes (%)';

function ShareBars({ rows, k, height }: { rows: Row[]; k: string; height: number }) {
  const r = [...rows].reverse();
  const [box, w] = useWidth<HTMLDivElement>();
  const narrow = w < 640;
  return (
    <div ref={box}>
    <Plot
      ariaLabel={`Horizontal bars of serious/fatal share by ${k}.`}
      height={height}
      data={[{
        type: 'bar', orientation: 'h', y: r.map((x) => String(x[k])), x: col(r, 'share_percent') as number[],
        marker: { color: '#2a6690' },
        text: r.map((x) => `${fmtFixed(x.share_percent, 1)}%  (n=${fmtInt(x.known_n)})`), textposition: narrow ? 'auto' : 'outside', cliponaxis: false,
        textfont: { size: narrow ? 9 : 12 },
        customdata: r.map((x) => [x.serious_fatal_n, x.known_n]),
        hovertemplate: '<b>%{y}</b><br>%{x:.3f}% serious/fatal<br>%{customdata[0]:,} of %{customdata[1]:,} known-severity records<extra></extra>',
      }]}
      layout={{ margin: { t: 6, l: narrow ? 90 : 170, r: narrow ? 12 : 120, b: 46 }, xaxis: { title: { text: narrow ? 'Serious/fatal share (%) of known severity' : SHARE_LABEL } } }}
    />
    </div>
  );
}

export function Figure3_7() {
  const s = useCsvs({
    collision: 'chart_data/report_figure_3_7/collision.csv',
    time: 'chart_data/report_figure_3_7/time.csv',
    illumination: 'chart_data/report_figure_3_7/illumination.csv',
    eCollision: 'chart_data/report_table_e_1/collision.csv',
    eTime: 'chart_data/report_table_e_2/time.csv',
    eIllum: 'chart_data/report_table_e_2/illumination.csv',
  });
  const [view, setView] = useState<'report' | 'full'>('report');
  const d = s.data;
  const sortDesc = (rows: Row[]) => [...rows].sort((a, b) => num(b.share_percent) - num(a.share_percent));
  return (
    <FigureFrame
      label="Figure 3.7"
      caption="Conditional serious/fatal shares for selected collision, time and illumination groups in the 2016–2023 common era. Sample sizes are printed beside the bars."
      itemId="report_figure_3_7"
      page={22}
      exploring={view !== 'report'}
      onReset={() => setView('report')}
      controls={<Segmented label="Categories" value={view} onChange={setView}
        options={[{ value: 'report', label: 'Report selection' }, { value: 'full', label: 'All categories (Appendix E tables)' }]} />}
      downloads={[
        { label: 'collision.csv', path: 'chart_data/report_figure_3_7/collision.csv' },
        { label: 'time.csv', path: 'chart_data/report_figure_3_7/time.csv' },
        { label: 'illumination.csv', path: 'chart_data/report_figure_3_7/illumination.csv' },
      ]}
      notes={view === 'full'
        ? 'All categories from Tables E.1–E.2, including very small groups (e.g. “Unknown”, n = 38 or 8) whose percentages are unstable. Shares are among reported, known-severity crashes; not exposure-adjusted risks.'
        : 'Report-only selection: 8 collision, 4 time and 6 illumination levels in descending share. Shares are among reported, known-severity crashes; not exposure-adjusted risks.'}
    >
      {!d ? <Loading state={s} /> : (
        <div className="space-y-2">
          <Panel title="Collision type"><ShareBars rows={view === 'report' ? d.collision : sortDesc(d.eCollision)} k="COLLISION_LABEL" height={view === 'report' ? 300 : 400} /></Panel>
          <Panel title="Derived time period"><ShareBars rows={view === 'report' ? d.time : sortDesc(d.eTime)} k="TIME_PERIOD" height={220} /></Panel>
          <Panel title="Recorded illumination"><ShareBars rows={view === 'report' ? d.illumination : sortDesc(d.eIllum)} k="ILLUMINATION_LABEL" height={view === 'report' ? 260 : 300} /></Panel>
        </div>
      )}
    </FigureFrame>
  );
}

export function Table3_1() {
  const s = useCsvs({ d: 'chart_data/report_table_3_1/association_tests.csv', pool: 'chart_data/report_table_3_1/pooling_audit.csv' });
  const names: Record<string, string> = {
    COLLISION_LABEL: 'Collision type', TIME_PERIOD: 'Time period', ILLUMINATION_LABEL: 'Illumination', INTERSECTION_LABEL: 'Intersection type',
  };
  return (
    <FigureFrame
      kind="Table"
      label="Table 3.1"
      caption="Post-2016 association tests of crash severity. All four tests use 77,476 known-severity records."
      itemId="report_table_3_1"
      page={23}
      downloads={[
        { label: 'association_tests.csv', path: 'chart_data/report_table_3_1/association_tests.csv' },
        { label: 'pooling_audit.csv', path: 'chart_data/report_table_3_1/pooling_audit.csv' },
      ]}
      dataView={s.data && (
        <>
          <p className="mb-2 font-semibold">Low-frequency levels pooled before testing</p>
          <DataTable rows={s.data.pool} columns={[
            { key: 'feature', label: 'Variable', format: (v) => names[String(v)] ?? v },
            { key: 'reason', label: 'Audit' },
            { key: 'pooled_original_levels', label: 'Pooled source levels' },
          ]} />
        </>
      )}
    >
      {!s.data ? <Loading state={s} /> : (
        <DataTable rows={s.data.d} columns={[
          { key: 'feature', label: 'Variable', format: (v) => names[String(v)] ?? v },
          { key: 'tested_levels', label: 'Levels tested', align: 'right' },
          { key: 'chi2_stat', label: 'χ²', align: 'right', format: (v) => fmtFixed(v, 2) },
          { key: 'degrees_freedom', label: 'd.f.', align: 'right' },
          { key: 'cramers_v', label: 'Cramér V', align: 'right', format: (v) => fmtFixed(v, 4) },
          { key: 'fdr_bh_q', label: 'BH-adjusted q', align: 'right', format: fmtQ },
        ]} footnote="Chi-square tests of independence on 2016–2023 known-severity records; four tested families corrected with Benjamini–Hochberg. Weather and road-surface tests withheld (historical mappings unverified)." />
      )}
    </FigureFrame>
  );
}

export function Figure3_8() {
  const s = useCsvs({ sel: 'chart_data/report_figure_3_8/adjusted_selected.csv', all: 'models/adjusted_association/adjusted_or.csv' });
  const [view, setView] = useState<'report' | 'all'>('report');
  const d = s.data;
  const rows = d ? (view === 'report' ? d.sel : d.all.filter((r) => !String(r.index_0).startsWith('Intercept'))) : [];
  const r = [...rows].reverse();
  const labels = r.map((x) => {
    const t = termLabel(String(x.index_0));
    return `${t.label}`;
  });
  const sig = r.map((x) => num(x.fdr_bh_q) > 0.05);
  const trace = (mask: boolean, name: string, color: string): Data => {
    const idx = r.map((_, i) => i).filter((i) => sig[i] === mask);
    return {
      type: 'scatter', mode: 'markers', name, marker: { color, size: 9 },
      y: idx.map((i) => `${termLabel(String(r[i].index_0)).family}: ${labels[i]}`),
      x: idx.map((i) => num(r[i].odds_ratio)),
      error_x: { type: 'data', symmetric: false, array: idx.map((i) => num(r[i].ci_upper_95) - num(r[i].odds_ratio)), arrayminus: idx.map((i) => num(r[i].odds_ratio) - num(r[i].ci_lower_95)), color, thickness: 2 },
      customdata: idx.map((i) => [r[i].ci_lower_95, r[i].ci_upper_95, fmtQ(r[i].fdr_bh_q), r[i].index_0]),
      hovertemplate: '<b>%{y}</b><br>OR %{x:.2f} (95% CI %{customdata[0]:.2f}–%{customdata[1]:.2f})<br>BH q = %{customdata[2]}<br><span style="font-size:11px">%{customdata[3]}</span><extra></extra>',
    } as Data;
  };
  const yOrder = r.map((x, i) => `${termLabel(String(x.index_0)).family}: ${labels[i]}`);
  return (
    <FigureFrame
      label="Figure 3.8"
      caption="Selected adjusted odds ratios from the 2016–2023 logistic model. Estimates are conditional associations, not causal effects; the red interval’s adjusted q-value exceeds 0.05."
      itemId="report_figure_3_8"
      page={24}
      exploring={view !== 'report'}
      onReset={() => setView('report')}
      controls={<Segmented label="Terms" value={view} onChange={setView}
        options={[{ value: 'report', label: 'Report selection (7 terms)' }, { value: 'all', label: 'All model terms' }]} />}
      downloads={[
        { label: 'adjusted_selected.csv', path: 'chart_data/report_figure_3_8/adjusted_selected.csv' },
        { label: 'adjusted_or.csv (all terms)', path: 'models/adjusted_association/adjusted_or.csv' },
        { label: 'coefficients.csv', path: 'models/adjusted_association/coefficients.csv' },
      ]}
      dataView={d && (
        <DataTable rows={rows} maxHeight={360} columns={[
          { key: 'index_0', label: 'Term', format: (v) => { const t = termLabel(String(v)); return `${t.family}: ${t.label}`; } },
          { key: 'odds_ratio', label: 'OR', align: 'right', format: (v) => fmtFixed(v, 2) },
          { key: 'ci_lower_95', label: '95% CI low', align: 'right', format: (v) => fmtFixed(v, 2) },
          { key: 'ci_upper_95', label: '95% CI high', align: 'right', format: (v) => fmtFixed(v, 2) },
          { key: 'fdr_bh_q', label: 'BH q', align: 'right', format: fmtQ },
        ]} footnote="HC0 robust 95% confidence intervals; Benjamini–Hochberg q-values. The exported formula also includes SPEED_LIMIT_VALID, which the report’s prose enumeration omits (documented export difference)." />
      )}
      notes="Log-scaled horizontal axis; the dashed line marks OR = 1. Red = BH-adjusted q > 0.05; blue otherwise."
    >
      {!d ? <Loading state={s} /> : (
        <Plot
          ariaLabel="Forest plot of adjusted odds ratios on a log scale; pedestrian vs angle OR 10.63, the dark/no-streetlight term in red with q 0.077."
          height={view === 'report' ? 360 : 1100}
          data={[trace(false, 'q ≤ 0.05', PALETTE.blue), trace(true, 'q > 0.05', PALETTE.red)]}
          layout={{
            margin: { l: view === 'report' ? 280 : 330, r: 20, t: 10, b: 50 },
            xaxis: { type: 'log', title: { text: 'Adjusted odds ratio (log scale)' } },
            yaxis: { categoryorder: 'array', categoryarray: yOrder },
            shapes: [{ type: 'line', x0: 1, x1: 1, yref: 'paper', y0: 0, y1: 1, line: { color: '#555', dash: 'dash', width: 1 } }],
            legend: { orientation: 'h', y: -0.12 },
          }}
        />
      )}
    </FigureFrame>
  );
}
