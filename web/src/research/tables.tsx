import { useState } from 'react';
import { FigureFrame } from '../components/FigureFrame';
import { Plot } from '../components/Plot';
import { Column, DataTable, Disclosure, Segmented } from '../components/ui';
import { Row, fmtFixed, fmtInt, useCsvs } from '../lib/data';
import { Loading } from './figures';

const pct = (d: number) => (v: unknown) => fmtFixed(v as number, d);

function CsvTable({
  label, caption, itemId, page, path, columns, footnote, transform, extra,
}: {
  label: string; caption: string; itemId: string; page?: number; path: string; columns: Column[];
  footnote?: React.ReactNode; transform?: (rows: Row[]) => Row[]; extra?: React.ReactNode;
}) {
  const s = useCsvs({ d: path });
  const rows = s.data ? (transform ? transform(s.data.d) : s.data.d) : [];
  return (
    <FigureFrame kind="Table" label={label} caption={caption} itemId={itemId} page={page}
      downloads={[{ label: path.split('/').pop()!, path }]}>
      {!s.data ? <Loading state={s} /> : <DataTable rows={rows} columns={columns} footnote={footnote} maxHeight={560} />}
      {extra}
    </FigureFrame>
  );
}

export function Table2_1() {
  const s = useCsvs({ d: 'chart_data/report_table_2_1/integrity.csv' });
  const r = s.data?.d[0];
  const rows: Row[] = r
    ? [
        { check: 'Rows and source columns', result: `${fmtInt(r.rows)} rows; ${r.source_columns} columns` },
        { check: 'Year range', result: `${r.first_year}–${r.last_year} inclusive` },
        { check: 'Unique crash reference numbers', result: fmtInt(r.unique_crash_ids) },
        { check: 'Exact duplicate rows', result: fmtInt(r.exact_duplicates) },
        { check: 'Repeated crash IDs', result: fmtInt(r.duplicate_ids) },
        { check: 'Binary-known severity outcomes', result: `${fmtInt(r.known_outcomes)} (${fmtFixed((100 * Number(r.known_outcomes)) / Number(r.rows), 2)}% of records)` },
      ]
    : [];
  return (
    <FigureFrame kind="Table" label="Table 2.1" caption="Initial checks of the crash dataset." itemId="report_table_2_1" page={13}
      downloads={[{ label: 'integrity.csv', path: 'chart_data/report_table_2_1/integrity.csv' }]}>
      {!s.data ? <Loading state={s} /> : (
        <DataTable rows={rows} columns={[{ key: 'check', label: 'Check' }, { key: 'result', label: 'Result' }]} />
      )}
    </FigureFrame>
  );
}

export function Table6_1() {
  return (
    <CsvTable label="Table 6.1" caption="Practical questions and the next evidence needed." itemId="report_table_6_1" page={33}
      path="chart_data/report_table_6_1/practical_questions.csv"
      columns={[
        { key: 'question', label: 'A team asks', format: (v) => <span className="font-medium">“{String(v)}”</span> },
        { key: 'report_supports', label: 'What this report supports' },
        { key: 'needed_next', label: 'What is needed next' },
      ]} />
  );
}

export function TableA_1() {
  return (
    <CsvTable label="Table A.1" caption="Selected field roles and interpretation notes." itemId="report_table_a_1" page={35}
      path="chart_data/report_table_a_1/selected_variable_notes.csv"
      columns={[
        { key: 'field_or_label', label: 'Field or derived label', format: (v) => <code className="text-[0.85em]">{String(v)}</code> },
        { key: 'analytical_role', label: 'Analytical role' },
        { key: 'interpretation_note', label: 'Interpretation note' },
      ]} />
  );
}

export function TableA_2() {
  const all = useCsvs({ d: 'chart_data/report_table_a_2/injury_all_checks.csv' });
  return (
    <CsvTable label="Table A.2" caption="Records where total injuries differed from the sum of components." itemId="report_table_a_2" page={36}
      path="chart_data/report_table_a_2/injury_report_display.csv"
      columns={[
        { key: 'year', label: 'Year' },
        { key: 'eligible_records', label: 'Records checked', align: 'right', format: fmtInt },
        { key: 'flagged_records', label: 'Mismatches', align: 'right', format: fmtInt },
        { key: 'flag_percent_of_eligible', label: 'Mismatches %', align: 'right', format: pct(2) },
      ]}
      footnote="Note: the paragraph above describes total injuries compared with fatal + major + moderate + minor injuries. The counts in this table actually compare the total injury count with major + moderate + minor + unknown-severity injuries; they are shown as computed. The component comparison is unavailable after 2018 — those years are not zero discrepancies."
      extra={
        <div className="mt-3">
          <Disclosure summary="All exported logical and reconciliation checks (all years)">
            {!all.data ? <Loading state={all} /> : (
              <DataTable rows={all.data.d} maxHeight={360} columns={[
                { key: 'comparison', label: 'Check' },
                { key: 'year', label: 'Year' },
                { key: 'eligible_records', label: 'Eligible', align: 'right', format: fmtInt },
                { key: 'flagged_records', label: 'Flagged', align: 'right', format: fmtInt },
                { key: 'largest_abs_difference', label: 'Largest |diff|', align: 'right', format: pct(0) },
                { key: 'flag_percent_of_eligible', label: 'Flagged %', align: 'right', format: pct(2) },
              ]} />
            )}
          </Disclosure>
        </div>
      } />
  );
}

export function TableD_1() {
  const s = useCsvs({ d: 'chart_data/report_table_d_1/annual_record_outcome_coverage.csv' });
  const [view, setView] = useState<'table' | 'chart'>('table');
  const d = s.data?.d ?? [];
  return (
    <FigureFrame kind="Table" label="Table D.1" caption="Annual records, known-severity coverage and severity proportions." itemId="report_table_d_1" page={39}
      exploring={view !== 'table'} onReset={() => setView('table')}
      controls={<Segmented label="View" value={view} onChange={setView} options={[{ value: 'table', label: 'Table (report)' }, { value: 'chart', label: 'Chart of the same rows' }]} />}
      downloads={[{ label: 'annual_record_outcome_coverage.csv', path: 'chart_data/report_table_d_1/annual_record_outcome_coverage.csv' }]}>
      {!s.data ? <Loading state={s} /> : view === 'table' ? (
        <DataTable rows={d} maxHeight={600} columns={[
          { key: 'CRASH_YEAR', label: 'Year' },
          { key: 'crash_records', label: 'Reports', align: 'right', format: fmtInt },
          { key: 'known_severity_records', label: 'Known outcome n', align: 'right', format: fmtInt },
          { key: 'known_severity_percent', label: 'Known %', align: 'right', format: pct(2) },
          { key: 'fatal_percent_of_known', label: 'Fatal %ᵃ', align: 'right', format: pct(2) },
          { key: 'serious_fatal_percent_of_known', label: 'Serious/fatal %ᵇ', align: 'right', format: (v, r) => (Number(r.CRASH_YEAR) < 2016 ? '–' : fmtFixed(v as number, 2)) },
        ]} footnote="ᵃFatal records divided by known-severity records. ᵇCodes 1/2 divided by known-severity records; deliberately blank before 2016." />
      ) : (
        <Plot ariaLabel="Bars of annual reports and known-outcome records with known percentage line." height={380}
          data={[
            { type: 'bar', name: 'Reports', x: d.map((r) => r.CRASH_YEAR as number), y: d.map((r) => r.crash_records as number), marker: { color: '#c9d6e3' }, hovertemplate: '%{x}: %{y:,} reports<extra></extra>' },
            { type: 'bar', name: 'Known outcome', x: d.map((r) => r.CRASH_YEAR as number), y: d.map((r) => r.known_severity_records as number), marker: { color: '#4c72b0' }, hovertemplate: '%{x}: %{y:,} known-outcome<extra></extra>' },
            { type: 'scatter', mode: 'lines+markers', name: 'Known %', yaxis: 'y2', x: d.map((r) => r.CRASH_YEAR as number), y: d.map((r) => r.known_severity_percent as number), line: { color: '#c0692b' }, hovertemplate: '%{x}: %{y:.2f}% known<extra></extra>' },
          ]}
          layout={{ barmode: 'overlay', margin: { r: 72 }, yaxis: { type: 'linear', title: { text: 'Records' } }, yaxis2: { type: 'linear', title: { text: 'Known %', standoff: 12 }, overlaying: 'y', side: 'right', range: [70, 90], automargin: true }, xaxis: { type: 'linear', dtick: 2 }, legend: { orientation: 'h', y: -0.18 } }} />
      )}
    </FigureFrame>
  );
}

export function TableD_2() {
  return (
    <CsvTable label="Table D.2" caption="Annual number of records with a valid hour." itemId="report_table_d_2" page={40}
      path="chart_data/report_table_d_2/valid_hour_coverage.csv"
      columns={[
        { key: 'CRASH_YEAR', label: 'Year' },
        { key: 'total_reports', label: 'Total reports', align: 'right', format: fmtInt },
        { key: 'valid_hour_records', label: 'Valid-hour records', align: 'right', format: fmtInt },
        { key: 'valid_hour_percent', label: 'Valid hour %', align: 'right', format: pct(2) },
        { key: 'records_at_0200', label: 'At 02:00 (export)', align: 'right', format: fmtInt },
      ]}
      footnote="The last column is an additional exported field (records recorded at 02:00, relevant to the time-heaping note in §3.2); it is not printed in the report table." />
  );
}

const shareCols = (labelKey: string, label: string): Column[] => [
  { key: labelKey, label },
  { key: 'known_n', label: 'Known n', align: 'right', format: fmtInt },
  { key: 'serious_fatal_n', label: 'Serious/fatal n', align: 'right', format: fmtInt },
  { key: 'share_percent', label: 'Share %', align: 'right', format: pct(3) },
];

export function TableE_1() {
  return <CsvTable label="Table E.1" caption="Serious/fatal share by collision type, 2016–2023." itemId="report_table_e_1" page={41}
    path="chart_data/report_table_e_1/collision.csv" columns={shareCols('COLLISION_LABEL', 'Collision category')} />;
}

export function TableE_2() {
  const s = useCsvs({ ill: 'chart_data/report_table_e_2/illumination.csv', time: 'chart_data/report_table_e_2/time.csv' });
  const rows: Row[] = s.data
    ? [
        { cat: 'Illumination', known_n: null, serious_fatal_n: null, share_percent: null, _h: 1 },
        ...s.data.ill.map((r) => ({ ...r, cat: r.ILLUMINATION_LABEL })),
        { cat: 'Derived time period', known_n: null, serious_fatal_n: null, share_percent: null, _h: 1 },
        ...s.data.time.map((r) => ({ ...r, cat: r.TIME_PERIOD })),
      ]
    : [];
  return (
    <FigureFrame kind="Table" label="Table E.2" caption="Serious/fatal share by illumination and derived time period." itemId="report_table_e_2" page={41}
      downloads={[{ label: 'illumination.csv', path: 'chart_data/report_table_e_2/illumination.csv' }, { label: 'time.csv', path: 'chart_data/report_table_e_2/time.csv' }]}>
      {!s.data ? <Loading state={s} /> : (
        <DataTable rows={rows} columns={[
          { key: 'cat', label: 'Category', format: (v, r) => (r._h ? <span className="font-semibold italic">{String(v)}</span> : String(v)) },
          { key: 'known_n', label: 'Known n', align: 'right', format: (v, r) => (r._h ? '' : fmtInt(v)) },
          { key: 'serious_fatal_n', label: 'Serious/fatal n', align: 'right', format: (v, r) => (r._h ? '' : fmtInt(v)) },
          { key: 'share_percent', label: 'Share %', align: 'right', format: (v, r) => (r._h ? '' : fmtFixed(v, 3)) },
        ]} />
      )}
    </FigureFrame>
  );
}

export function TableE_3() {
  return <CsvTable label="Table E.3" caption="Serious/fatal share by intersection context, 2016–2023." itemId="report_table_e_3" page={42}
    path="chart_data/report_table_e_3/intersection.csv" columns={shareCols('INTERSECTION_LABEL', 'Context')}
    footnote="Intersection categories were pooled for the formal chi-square test where counts were sparse. One-record or very small categories should not be used to rank an actual design feature." />;
}

const FIELD_NAMES: Record<string, string> = {
  SPEED_LIMIT: 'Speed limit', LANE_COUNT: 'Lane count', STREET_NAME: 'Street name', DEC_LAT: 'State-route decimal latitude',
  DEC_LONG: 'State-route decimal longitude', ROUTE: 'Route', SEGMENT: 'Segment', OFFSET: 'Offset',
  EST_HRS_CLOSED: 'Estimated closure hours', TOT_INJ_COUNT: 'Total injury count',
};

export function TableG_1() {
  const s = useCsvs({ d: 'chart_data/report_table_g_1/report_display_completeness.csv' });
  return (
    <FigureFrame kind="Table" label="Table G.1" caption="Selected field completeness, 248,810 crash records." itemId="report_table_g_1" page={45}
      downloads={[
        { label: 'report_display_completeness.csv', path: 'chart_data/report_table_g_1/report_display_completeness.csv' },
        { label: 'selected_field_completeness.csv', path: 'chart_data/report_table_g_1/selected_field_completeness.csv' },
      ]}>
      {!s.data ? <Loading state={s} /> : (
        <DataTable rows={s.data.d} columns={[
          { key: 'field', label: 'Field', format: (v) => FIELD_NAMES[String(v)] ?? String(v) },
          { key: 'available_n', label: 'Available records', align: 'right', format: fmtInt },
          { key: 'available_percent', label: 'Available %', align: 'right', format: pct(2) },
          { key: 'source_nonmissing_n', label: 'Raw non-missing (export)', align: 'right', format: fmtInt },
        ]} footnote="Note: “available” is defined as non-missing, but both coordinate rows show 238,556, the number of records with a valid latitude–longitude pair. The non-missing counts are 238,608 (latitude) and 238,600 (longitude), shown in the last column. The printed 95.90% follows those non-missing counts; 238,556 of 248,810 would be 95.88%. The report’s printed values are shown." />
      )}
    </FigureFrame>
  );
}

export function TableG_2() {
  return <CsvTable label="Table G.2" caption="Fields with the highest missingness in the 248,810-record dataset." itemId="report_table_g_2" page={45}
    path="chart_data/report_table_g_2/missing_top30.csv"
    columns={[
      { key: 'index_0', label: 'Field', format: (v) => <code className="text-[0.85em]">{String(v)}</code> },
      { key: 'missing_count', label: 'Missing records', align: 'right', format: fmtInt },
      { key: 'missing_percent', label: 'Missing %', align: 'right', format: pct(2) },
    ]} />;
}

export function TableG_3() {
  return <CsvTable label="Table G.3" caption="Annual availability of selected coordinate fields." itemId="report_table_g_3" page={46}
    path="chart_data/report_table_g_3/coordinate_coverage_before_county.csv"
    columns={[
      { key: 'CRASH_YEAR', label: 'Year' },
      { key: 'reports', label: 'Reports', align: 'right', format: fmtInt },
      { key: 'selected', label: 'Selected coordinates', align: 'right', format: fmtInt },
      { key: 'unavailable_or_ambiguous', label: 'Unavailable/ambiguous', align: 'right', format: fmtInt },
    ]}
    footnote="Counts describe coordinate availability before the county-polygon screen, not a verified match to a road segment." />;
}

export function TableG_4() {
  return <CsvTable label="Table G.4" caption="Requirements and status for gated road-safety analyses." itemId="report_table_g_4" page={47}
    path="chart_data/report_table_g_4/gates.csv"
    columns={[
      { key: 'report_analysis', label: 'Analysis' },
      { key: 'required', label: 'Required input' },
      { key: 'report_status', label: 'Status in this analysis' },
    ]} />;
}
