import { Link } from 'react-router-dom';
import { BookOpen, FolderOpen, BarChart3, FlaskConical, ArrowRight } from 'lucide-react';
import { Callout } from '../components/ui';

const STATS: { value: string; label: string; note: string }[] = [
  { value: '248,810', label: 'police-reported crashes', note: '2004–2024 · 191 source fields · no duplicate IDs' },
  { value: '82.61%', label: 'with a known severity outcome', note: '205,544 records with codes 0–4' },
  { value: '77,476', label: 'common-era known-severity records', note: '2016–2023 · 3,233 serious/fatal (4.17%)' },
  { value: '26.9%', label: 'serious/fatal share, pedestrian crashes', note: '496 of 1,846 reported, known-severity · not a risk rate' },
  { value: '10.63', label: 'adjusted odds ratio, pedestrian vs angle', note: 'robust 95% CI 9.35–12.10 · association, not causation' },
  { value: '0.1548', label: 'best average precision (test 2022–2024)', note: 'HistGradientBoosting + collision · prevalence 4.44%' },
];

const CHAPTERS = [
  { to: '/introduction', n: '1', title: 'Introduction', text: 'Motivation, the four study questions, scope and how to read the results.' },
  { to: '/data-cleaning', n: '2', title: 'Data Cleaning', text: 'Source checks, variable roles, duplicates, missingness by field and year, retained unknowns.' },
  { to: '/visualization', n: '3', title: 'Visualization', text: 'Severity mix, time patterns and the 2016 boundary, context, counts, conditional shares, tests and odds ratios.' },
  { to: '/feature-engineering', n: '4', title: 'Feature Engineering', text: 'Derived variables, leakage safeguards, the coordinate audit and historical spatial concentration.' },
  { to: '/model-fitting', n: '5', title: 'Model Fitting', text: 'Chronological severity classification, model comparison, review queues, calibration and archetypes.' },
  { to: '/conclusion', n: '6', title: 'Conclusion & Future Scope', text: 'Findings with their limits, practical implications, challenges and the next phase.' },
];

const FINDINGS = [
  'The extract passes basic identity checks (248,810 rows and unique crash IDs, no exact duplicates) — a reproducible start, not proof of error-free reporting.',
  'Severity is unknown for 43,266 records; they are excluded from binary calculations rather than treated as non-severe.',
  'A 2016 severity-standard change and the 2024 collapse in time/illumination coverage (387 of 10,228 valid hours) limit trend and context comparisons; principal comparisons use 2016–2023.',
  'Among reported, known-severity crashes, pedestrian (26.87%) and head-on (9.48%) crashes have much higher serious/fatal shares than angle (3.33%) or rear-end (1.74%) crashes.',
  'An adjusted logistic model keeps a strong association between collision type and severity; no coefficient establishes causation.',
  'Classifiers rank later serious/fatal cases better than the baseline only modestly (AP 0.14–0.15), and the most useful feature, collision type, is recorded after the crash.',
  'Maps show where reports accumulated historically — not high-risk sites. Site-frequency, Empirical Bayes and countermeasure analyses were not run because their reviewed inputs were absent.',
];


export function Overview() {
  return (
    <div>
      <section className="border-b border-paper-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8 lg:py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">IT 462 Exploratory Data Analysis · Group B8 · Autumn 2026</p>
          <h1 className="mt-2 max-w-4xl font-serif text-3xl font-semibold leading-tight text-ink sm:text-5xl">
            Road accidents in Allegheny County, Pennsylvania
          </h1>
          <p className="mt-2 text-lg text-ink-soft">A study of police-reported crash records, 2004–2024</p>
          <p className="mt-5 max-w-3xl text-[1.05rem] leading-relaxed text-ink">
            This site presents our exploratory data analysis of 248,810 police-reported crashes. It examines data completeness, crash timing and
            context, serious/fatal outcomes, geographic coverage and the performance of severity classifiers — and is explicit about where the
            records stop short. The figures are rebuilt from the verified analysis export, so you can hover for exact values, inspect
            denominators and download the underlying tables.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/report" className="btn-primary text-base"><BookOpen aria-hidden className="h-4 w-4" /> Read the report</Link>
            <Link to="/introduction" className="btn-secondary text-base">Start with Chapter 1 <ArrowRight aria-hidden className="h-4 w-4" /></Link>
            <Link to="/resources" className="btn-secondary text-base"><FolderOpen aria-hidden className="h-4 w-4" /> Resources &amp; downloads</Link>
          </div>
          <p className="mt-4 text-sm text-ink-faint">
            Vishesh Shah · Atharv Trivedi · Darshan Talati · Dharmesh Upadhyay — under the guidance of Dr. Gopinath Panda, Dhirubhai Ambani University.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 lg:px-8">
        <section aria-labelledby="numbers">
          <h2 id="numbers" className="font-serif text-2xl font-semibold">Key numbers from the report</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.label} className="card p-5">
                <p className="font-serif text-3xl font-semibold tabular-nums text-accent-dark">{s.value}</p>
                <p className="mt-1 font-semibold text-ink">{s.label}</p>
                <p className="mt-1 text-sm text-ink-soft">{s.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="findings" className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <h2 id="findings" className="font-serif text-2xl font-semibold">Key findings — each with its boundary</h2>
            <ol className="mt-4 list-decimal space-y-2.5 pl-6 leading-relaxed">
              {FINDINGS.map((f) => <li key={f}>{f}</li>)}
            </ol>
            <p className="mt-3 text-sm">
              Full wording: <Link className="link" to="/conclusion#sec-6-1">§6.1 Findings and observations</Link>.
            </p>
          </div>
          <div>
            <Callout kind="caution" title="How to read these results">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Counts and shares describe <em>reported</em> crashes; no traffic-exposure denominator exists, so nothing here is a risk per trip or per mile.</li>
                <li>Associations are not causes. Odds ratios are conditional on the fields recorded.</li>
                <li>The classifiers rank the severity of crashes that already happened; they do not predict whether or where a crash will occur.</li>
                <li>Maps show historical concentration of reports, not verified dangerous sites.</li>
              </ul>
            </Callout>
          </div>
        </section>

        <section aria-labelledby="chapters">
          <h2 id="chapters" className="font-serif text-2xl font-semibold">The report, chapter by chapter</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHAPTERS.map((c) => (
              <Link key={c.to} to={c.to} className="card group p-5 hover:border-accent/50">
                <p className="text-sm font-semibold text-accent">Chapter {c.n}</p>
                <p className="mt-0.5 font-serif text-xl font-semibold group-hover:text-accent-dark">{c.title}</p>
                <p className="mt-2 text-sm text-ink-soft">{c.text}</p>
              </Link>
            ))}
            <Link to="/appendices" className="card group p-5 hover:border-accent/50 sm:col-span-2 lg:col-span-3">
              <p className="font-serif text-xl font-semibold group-hover:text-accent-dark">Appendices A–G</p>
              <p className="mt-2 text-sm text-ink-soft">
                Variable notes, metric definitions, software, the annual ledger, full category tables with denominators, model review queues,
                and the completeness and geographic audit.
              </p>
            </Link>
          </div>
        </section>

        <section aria-labelledby="features" className="grid gap-4 md:grid-cols-3">
          <h2 id="features" className="sr-only">What you can do here</h2>
          <div className="card p-5">
            <BarChart3 aria-hidden className="h-6 w-6 text-accent" />
            <p className="mt-2 font-semibold">Interactive figures</p>
            <p className="mt-1 text-sm text-ink-soft">
              Hover for exact counts and denominators, zoom, toggle legends, switch to clearly-marked exploration views, compare with the report
              page and download each figure’s data.
            </p>
          </div>
          <div className="card p-5">
            <BookOpen aria-hidden className="h-6 w-6 text-accent" />
            <p className="mt-2 font-semibold">The original report</p>
            <p className="mt-1 text-sm text-ink-soft">
              A page-turning reader for the PDF with page navigation, zoom, fullscreen and download, plus a plain scrolling fallback.
            </p>
          </div>
          <div className="card p-5">
            <FlaskConical aria-hidden className="h-6 w-6 text-accent" />
            <p className="mt-2 font-semibold">EDAgent — analyse your own data</p>
            <p className="mt-1 text-sm text-ink-soft">
              A separate tool: upload a CSV, TSV, JSON or Excel file to get quality checks, configurable charts, optional dataset-grounded chat
              and an exportable report. <Link className="link" to="/edagent">Open EDAgent</Link>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
