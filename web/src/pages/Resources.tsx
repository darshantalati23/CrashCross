import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Database, FileCode2, Github, Download, ExternalLink, ListTree, Library } from 'lucide-react';
import { DATA_BASE, Row, fmtInt, useCsvs, useJson } from '../lib/data';
import { Badge, DataTable, Disclosure } from '../components/ui';

export const REPO_URL = 'https://github.com/ExploratoryDataAnalysis/CrashCross';
const NOTEBOOK_GITHUB = `${REPO_URL}/blob/main/web/public/data/resources/EDA_v6.ipynb`;

interface PublishedFile { path: string; bytes: number; access: string; source_sha256: string }
interface SiteManifest { run_id: string; status: string; published_files: PublishedFile[]; derived_files: string[] }

function Card({ icon: Icon, title, children }: { icon: typeof BookOpen; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-serif text-xl font-semibold"><Icon aria-hidden className="h-5 w-5 text-accent" /> {title}</h2>
      <div className="mt-3 space-y-2 text-[0.95rem] text-ink-soft">{children}</div>
    </section>
  );
}

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a className="link" href={href} target="_blank" rel="noreferrer">{children}<ExternalLink aria-hidden className="ml-0.5 inline h-3 w-3" /></a>
);

const GROUPS: [string, string][] = [
  ['chart_data/', 'Report figure and table data'],
  ['statistical_tables/', 'Statistical tables (contingency, expected counts, correlations)'],
  ['model_evaluation/', 'Saved model-evaluation results'],
  ['models/', 'Model summaries (coefficients, odds ratios, importances, cluster profiles)'],
  ['spatial/', 'Spatial summaries and county boundary'],
];

function DataDictionary() {
  const s = useCsvs({ d: 'resources/data_dictionary.csv' });
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const all = s.data?.d ?? [];
    const t = q.trim().toLowerCase();
    return t ? all.filter((r) => String(r.field).toLowerCase().includes(t)) : all;
  }, [s.data, q]);
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm">
        Filter fields <input className="input w-56" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. INJ, LAT, WZ_" />
        <span className="text-ink-faint">{rows.length} shown</span>
      </label>
      <DataTable rows={rows as Row[]} maxHeight={420} columns={[
        { key: 'field', label: 'Field', format: (v) => <code className="text-[0.85em]">{String(v)}</code> },
        { key: 'storage_type', label: 'Storage type' },
        { key: 'source_or_derived', label: 'Source / derived' },
        { key: 'nonmissing_n', label: 'Non-missing', align: 'right', format: fmtInt },
        { key: 'missing_n', label: 'Missing', align: 'right', format: fmtInt },
      ]} footnote="Field inventory of the prepared analysis table produced by the export (source and derived fields over 248,810 records). For code meanings, use the PennDOT data dictionary linked above." />
    </div>
  );
}

export function ResourcesPage() {
  const m = useJson<SiteManifest>('site_manifest.json');
  const grouped = useMemo(() => {
    const files = m.data?.published_files ?? [];
    return GROUPS.map(([prefix, label]) => ({
      label,
      files: files.filter((f) => f.path.startsWith(prefix) && (f.path.endsWith('.csv') || f.path.endsWith('.geojson'))),
    }));
  }, [m.data]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Resources</h1>
      <p className="mt-2 max-w-3xl text-lg text-ink-soft">
        The report, the original analysis notebook, the dataset and its documentation, the code repository, references and the public data
        files behind every figure on this site.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card icon={BookOpen} title="Report">
          <p>Exploratory Data Analysis on Road Accidents in Allegheny County, Pennsylvania — Group B8, IT 462, 18 November 2026 (PDF, 50 pages, 1.4 MB).</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link className="btn-primary" to="/report">Open in the reader</Link>
            <a className="btn-secondary" href={`${DATA_BASE}/resources/report.pdf`} download="EDA_report_Allegheny_crashes_GroupB8.pdf"><Download aria-hidden className="h-4 w-4" /> Download PDF</a>
          </div>
        </Card>
        <Card icon={FileCode2} title="Original notebook">
          <p>
            <code>EDA_v6.ipynb</code> — the immutable research notebook (Python 3.13) behind every result in the report. It is provided as a
            reference; the website itself never executes it.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a className="btn-secondary" href={`${DATA_BASE}/resources/EDA_v6.ipynb`} download><Download aria-hidden className="h-4 w-4" /> Download .ipynb (3.5 MB)</a>
            <a className="btn-secondary" href={NOTEBOOK_GITHUB} target="_blank" rel="noreferrer"><Github aria-hidden className="h-4 w-4" /> View on GitHub</a>
          </div>
        </Card>
        <Card icon={Database} title="Dataset">
          <p>
            <strong>Allegheny County Crash Data</strong>, Western Pennsylvania Regional Data Center (WPRDC), resource
            2c13021f-74a9-4289-a1e5-fe0472c89881. The publisher’s metadata (snapshot bundled with the analysis export) lists the licence as
            Creative Commons CCZero. The analysed extract has 248,810 records and 191 fields, 2004–2024.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><Ext href="https://data.wprdc.org/dataset/allegheny-county-crash-data/resource/2c13021f-74a9-4289-a1e5-fe0472c89881">Dataset page on WPRDC</Ext></li>
            <li><Ext href="https://data.wprdc.org/datastore/dump/2c13021f-74a9-4289-a1e5-fe0472c89881">Cumulative crash data — CSV download (large)</Ext></li>
            <li><Ext href="https://data.wprdc.org/dataset/allegheny-county-crash-data">All yearly files and related resources</Ext></li>
          </ul>
          <p className="text-sm">The publisher may have updated the file since our extract; results here refer to the extract described in the report.</p>
        </Card>
        <Card icon={ListTree} title="Data dictionary and codebooks">
          <ul className="list-disc space-y-1 pl-5">
            <li><Ext href="https://gis.penndot.pa.gov/gishub/crashZip/Crash_Data_Dictionary_2026.pdf">PennDOT Crash Data Dictionary (2026 edition, PDF)</Ext></li>
            <li><Ext href="https://data.wprdc.org/dataset/3130f583-9499-472b-bb5a-f63a6ff6059a/resource/c884d6da-588d-45ec-b029-8aaec8018500/download/database-primer-4-15.pdf">Crash Database Primer (April 2015, WPRDC)</Ext></li>
            <li><Ext href="https://gis.penndot.pa.gov/gishub/crashZip/crash_database_primer.pdf">Crash Database Primer (current, PennDOT GIS Hub)</Ext></li>
            <li><Ext href="https://data.wprdc.org/dataset/3130f583-9499-472b-bb5a-f63a6ff6059a/resource/fb81a55f-c560-4541-9ad4-7ea7c41f79e7/download/municipalitycodes.csv">Municipality codes (CSV)</Ext> · <Ext href="https://data.wprdc.org/dataset/3130f583-9499-472b-bb5a-f63a6ff6059a/resource/057dc1b4-a720-4593-8a0c-02f302b8b817/download/policeagencycodes.csv">Police agency codes (CSV)</Ext></li>
          </ul>
          <p className="text-sm">Codebooks are linked at their publishers rather than re-hosted. The report notes that historical weather/surface mappings remain unverified against year-specific codebooks.</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <a className="btn-secondary" href={`${DATA_BASE}/resources/data_dictionary.csv`} download><Download aria-hidden className="h-4 w-4" /> Project field inventory (CSV)</a>
          </div>
        </Card>
        <Card icon={Github} title="Code repository">
          <ul className="list-disc space-y-1 pl-5">
            <li><Ext href={REPO_URL}>CrashCross</Ext> — this website (React research site, EDAgent API, data build script and documentation).</li>
            <li><Ext href="https://github.com/ExploratoryDataAnalysis/EDAgent">EDAgent</Ext> — the earlier EDA workspace whose ingestion and AI-grounding ideas the EDAgent tab adapts.</li>
          </ul>
        </Card>
        <Card icon={Library} title="References">
          <p>
            [1] Western Pennsylvania Regional Data Center (WPRDC). <em>Allegheny County Crash Data</em>, resource ID
            2c13021f-74a9-4289-a1e5-fe0472c89881. Public dataset. Available at{' '}
            <Ext href="https://data.wprdc.org/dataset/allegheny-county-crash-data/resource/2c13021f-74a9-4289-a1e5-fe0472c89881">data.wprdc.org</Ext>.
          </p>
          <p className="text-sm">Software versions used for the analysis are listed in <Link className="link" to="/appendices#sec-C">Appendix C</Link>.</p>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Field inventory</h2>
        <div className="mt-3"><DataDictionary /></div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold">Public data downloads</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">
          Aggregate CSV files from export run {m.data ? <code>{m.data.run_id}</code> : '…'} ({m.data && <Badge tone="ok">{m.data.status}</Badge>}). Each figure on
          this site also offers its own files. Record-level data, crash identifiers, individual model scores and trained model files are
          internal review artifacts and are not published.
        </p>
        <div className="mt-4 space-y-2">
          {grouped.map((g) => (
            <Disclosure key={g.label} summary={`${g.label} (${g.files.length} files)`}>
              <ul className="grid gap-1 sm:grid-cols-2">
                {g.files.map((f) => (
                  <li key={f.path} className="flex items-baseline justify-between gap-2">
                    <a className="link break-all" href={`${DATA_BASE}/${f.path}`} download>{f.path}</a>
                    <span className="shrink-0 text-xs text-ink-faint">{(f.bytes / 1024).toFixed(f.bytes < 10240 ? 1 : 0)} KB</span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          ))}
          <p className="pt-2 text-sm">
            Provenance manifest with SHA-256 hashes for every published file:{' '}
            <a className="link" href={`${DATA_BASE}/site_manifest.json`} download>site_manifest.json</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
