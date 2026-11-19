import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb } from 'lucide-react';
import { Disclosure } from '../components/ui';

export interface TocEntry {
  id: string;
  number: string;
  title: string;
}

export function sectionAnchor(number: string) {
  return `sec-${number.replace(/\./g, '-')}`;
}

/** A numbered report section. */
export function S({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section id={sectionAnchor(number)} className="scroll-mt-24 pt-6">
      <h2 className="font-serif text-2xl font-semibold text-ink">
        <span className="mr-2 text-ink-faint">{number}</span>
        {title}
      </h2>
      <div className="report-prose mt-3">{children}</div>
    </section>
  );
}

/** Sub-heading inside a section (appendix sub-parts). */
export function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-6 font-serif text-lg font-semibold text-ink">{children}</h3>;
}

/** The report's “in practice” illustrative paragraphs, collapsed by default for readability. */
export function Example({ title = 'Practical example', children }: { title?: string; children: ReactNode }) {
  return (
    <Disclosure
      className="my-4 border-[#d9cfb4] bg-[#fbf8f0]"
      summary={
        <span className="flex items-center gap-2">
          <Lightbulb aria-hidden className="h-4 w-4 text-[#9a7b2c]" /> {title}
        </span>
      }
    >
      <div className="report-prose">{children}</div>
    </Disclosure>
  );
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

export function ChapterLayout({
  eyebrow,
  title,
  lead,
  toc,
  pages,
  prev,
  next,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  toc: TocEntry[];
  pages: string;
  prev?: { to: string; label: string };
  next?: { to: string; label: string };
  children: ReactNode;
}) {
  const active = useActiveSection(toc.map((t) => t.id));
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8">
      <nav aria-label="Sections in this chapter" className="hidden lg:block">
        <div className="sticky top-24 space-y-1 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">On this page</p>
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              aria-current={active === t.id ? 'location' : undefined}
              className={`block rounded px-2 py-1 leading-snug ${active === t.id ? 'bg-accent-soft font-semibold text-accent-dark' : 'text-ink-soft hover:bg-paper-line/40'}`}
            >
              <span className="mr-1 text-ink-faint">{t.number}</span> {t.title}
            </a>
          ))}
          <p className="pt-4 text-xs text-ink-faint">Report pages {pages}</p>
        </div>
      </nav>
      <article className="min-w-0">
        <header className="border-b border-paper-line pb-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">{eyebrow}</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
          {lead && <div className="mt-3 max-w-prose text-lg leading-relaxed text-ink-soft">{lead}</div>}
          <details className="mt-4 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-accent">Sections in this chapter</summary>
            <ul className="mt-2 space-y-1 text-sm">
              {toc.map((t) => (
                <li key={t.id}>
                  <a className="link" href={`#${t.id}`}>
                    {t.number} {t.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </header>
        {children}
        <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t border-paper-line pt-5 text-sm">
          {prev ? <Link className="btn-secondary" to={prev.to}>← {prev.label}</Link> : <span />}
          {next && <Link className="btn-primary" to={next.to}>{next.label} →</Link>}
        </footer>
      </article>
    </div>
  );
}

export function toc(entries: [string, string][]): TocEntry[] {
  return entries.map(([number, title]) => ({ id: sectionAnchor(number), number, title }));
}
