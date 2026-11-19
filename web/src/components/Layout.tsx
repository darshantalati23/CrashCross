import { ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export const RESEARCH_TABS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/introduction', label: '1 Introduction' },
  { to: '/data-cleaning', label: '2 Data Cleaning' },
  { to: '/visualization', label: '3 Visualization' },
  { to: '/feature-engineering', label: '4 Feature Engineering' },
  { to: '/model-fitting', label: '5 Model Fitting' },
  { to: '/conclusion', label: '6 Conclusion & Future Scope' },
  { to: '/appendices', label: 'Appendices' },
  { to: '/report', label: 'Report' },
  { to: '/resources', label: 'Resources' },
];

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    // Content (figures) loads asynchronously; retry briefly until the anchor exists.
    let tries = 0;
    const id = decodeURIComponent(hash.slice(1));
    const t = setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++tries > 30) {
        clearInterval(t);
        el?.scrollIntoView({ block: 'start' });
      }
    }, 100);
    return () => clearInterval(t);
  }, [pathname, hash]);
  return null;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-t-md border-b-2 px-2.5 py-2 text-[0.84rem] font-medium transition-colors motion-reduce:transition-none ${
    isActive ? 'border-accent text-accent-dark' : 'border-transparent text-ink-soft hover:border-paper-line hover:text-ink'
  }`;

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const isEdagent = pathname.startsWith('/edagent');
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <ScrollManager />
      <header className="sticky top-0 z-40 border-b border-paper-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-3 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="leading-tight">
              <span className="block font-serif text-lg font-semibold text-ink">CrashCross</span>
              <span className="block text-xs text-ink-faint">Allegheny County crash records, 2004–2024 · IT 462 EDA</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <NavLink
              to="/edagent"
              className={({ isActive }) =>
                `hidden rounded-md border px-3 py-1.5 text-sm font-semibold sm:inline-block ${isActive ? 'border-accent bg-accent text-white' : 'border-accent/40 text-accent-dark hover:bg-accent-soft'}`
              }
            >
              EDAgent tool
            </NavLink>
            <button
              type="button"
              className="rounded-md p-2 text-ink-soft hover:bg-paper-line/50 lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close navigation' : 'Open navigation'}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <nav aria-label="Research sections" className="mx-auto hidden max-w-7xl flex-wrap gap-x-0.5 px-4 pt-2 lg:flex lg:px-8">
          {RESEARCH_TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
              {t.label}
            </NavLink>
          ))}
          <span aria-hidden className="mx-2 my-2 w-px bg-paper-line" />
          <NavLink to="/edagent" className={tabClass}>
            EDAgent
          </NavLink>
        </nav>
        {open && (
          <nav id="mobile-nav" aria-label="Site navigation" className="border-t border-paper-line px-4 py-2 lg:hidden">
            <ul className="grid gap-0.5">
              {[...RESEARCH_TABS, { to: '/edagent', label: 'EDAgent (analysis tool)', end: false }].map((t) => (
                <li key={t.to}>
                  <NavLink
                    to={t.to}
                    end={t.end}
                    className={({ isActive }) => `block rounded px-3 py-2 text-sm ${isActive ? 'bg-accent-soft font-semibold text-accent-dark' : 'text-ink-soft'}`}
                  >
                    {t.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {!open && <div className="h-3 lg:hidden" />}
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-paper-line bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-4 py-5 text-xs text-ink-faint lg:px-8">
          <p>
            Group B8 · IT 462 Exploratory Data Analysis · Dhirubhai Ambani University · Data: WPRDC Allegheny County Crash Data (CC0).
          </p>
          <p>
            {isEdagent
              ? 'EDAgent analyses only the file you upload; it is separate from the research results.'
              : 'Research figures are drawn from the verified export run v6-export-20261120-08.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
