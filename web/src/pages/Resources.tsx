import { Link } from 'react-router-dom';
import { BookOpen, Database, FileCode2, Github, Download, ExternalLink, Library } from 'lucide-react';
import { DATA_BASE } from '../lib/data';

/** Public EDAgent reference repository (verified reachable, HTTP 200, 2026-11-20). */
const EDAGENT_REPO_URL = 'https://github.com/ExploratoryDataAnalysis/EDAgent';

function Card({ icon: Icon, title, children }: { icon: typeof BookOpen; title: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col p-5 sm:p-6" aria-labelledby={`res-${title}`}>
      <h2 id={`res-${title}`} className="flex items-center gap-2 font-serif text-xl font-semibold">
        <Icon aria-hidden className="h-5 w-5 text-accent" /> {title}
      </h2>
      <div className="mt-3 flex flex-1 flex-col gap-2 text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a className="link" href={href} target="_blank" rel="noreferrer">
    {children}
    <ExternalLink aria-hidden className="ml-0.5 inline h-3 w-3" />
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

export function ResourcesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 lg:py-10">
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">Resources</h1>
      <p className="mt-2 max-w-3xl text-lg leading-relaxed text-ink-soft">
        The report, the original analysis notebook, the dataset, related code and references.
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card icon={BookOpen} title="Report">
          <p>Exploratory Data Analysis on Road Accidents in Allegheny County, Pennsylvania — Group B8, IT 462, 18 November 2026 (PDF, 50 pages, 1.4 MB).</p>
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Link className="btn-primary" to="/report">Open in the reader</Link>
            <a className="btn-secondary" href={`${DATA_BASE}/resources/report.pdf`} download="EDA_report_Allegheny_crashes_GroupB8.pdf">
              <Download aria-hidden className="h-4 w-4" /> Download PDF
            </a>
          </div>
        </Card>
        <Card icon={FileCode2} title="Original notebook">
          <p>
            <code>EDA_v6.ipynb</code> — the research notebook (Python 3.13) behind every result in the report. It is provided as a
            reference; the website never runs it.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <a className="btn-secondary" href={`${DATA_BASE}/resources/EDA_v6.ipynb`} download>
              <Download aria-hidden className="h-4 w-4" /> Download .ipynb (3.5 MB)
            </a>
          </div>
        </Card>
        <Card icon={Database} title="Dataset">
          <p>
            <strong className="text-ink">Allegheny County Crash Data</strong>, Western Pennsylvania Regional Data Center (WPRDC), resource
            2c13021f-74a9-4289-a1e5-fe0472c89881. The publisher lists the licence as Creative Commons CCZero. The analysed extract has
            248,810 records and 191 fields, 2004–2024.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><Ext href="https://data.wprdc.org/dataset/allegheny-county-crash-data/resource/2c13021f-74a9-4289-a1e5-fe0472c89881">Dataset page on WPRDC</Ext></li>
            <li><Ext href="https://data.wprdc.org/datastore/dump/2c13021f-74a9-4289-a1e5-fe0472c89881">Cumulative crash data — CSV download (large)</Ext></li>
            <li><Ext href="https://data.wprdc.org/dataset/allegheny-county-crash-data">All yearly files and related resources</Ext></li>
          </ul>
          <p className="text-sm">The publisher may have updated the file since our extract; results here refer to the extract described in the report.</p>
        </Card>
        <Card icon={Github} title="Code">
          <p>
            <Ext href={EDAGENT_REPO_URL}>EDAgent</Ext> — the earlier exploratory-analysis workspace whose ingestion and grounded-chat
            design the EDAgent tab adapts.
          </p>
          <p className="text-sm">The source repository for this website is not publicly available.</p>
        </Card>
        <Card icon={Library} title="References">
          <p>
            [1] Western Pennsylvania Regional Data Center (WPRDC). <em>Allegheny County Crash Data</em>, resource ID
            2c13021f-74a9-4289-a1e5-fe0472c89881. Public dataset. Available at{' '}
            <Ext href="https://data.wprdc.org/dataset/allegheny-county-crash-data/resource/2c13021f-74a9-4289-a1e5-fe0472c89881">data.wprdc.org</Ext>.
          </p>
          <p className="text-sm">
            Software versions used for the analysis are listed in <Link className="link" to="/appendices#sec-C">Appendix C</Link>.
          </p>
        </Card>
      </div>
    </div>
  );
}
