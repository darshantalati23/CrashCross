import { useCatalogue } from '../components/FigureFrame';
import { Badge, Disclosure } from '../components/ui';
import { DATA_BASE } from '../lib/data';
import { Loading } from './figures';

const SHOWN_ON_SITE: Record<string, string> = {
  supplementary_rounded_grid: 'Interactive map in §4.4',
  supplementary_temporal_evaluation: 'Interactive diagnostics in §5.4',
  supplementary_enhanced_models: 'Permutation importance in §5.4',
  supplementary_archetypes: 'Candidate diagnostics with Figure 5.2',
  supplementary_coordinate_diagnostics: 'Candidate comparison table in §4.3',
};

export function SupplementaryIndex() {
  const cat = useCatalogue();
  if (!cat.data) return <Loading state={cat} />;
  const items = Object.values(cat.data).filter((i) => i.item_id.startsWith('supplementary_'));
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const full = it as typeof it & { title?: string; published_paths?: string[]; unpublished_paths?: string[] };
        const pub = (full.published_paths ?? []).filter((p) => !p.endsWith('.json') || p.startsWith('derived'));
        return (
          <Disclosure
            key={it.item_id}
            summary={
              <span className="flex flex-wrap items-center gap-2">
                {full.title}
                {SHOWN_ON_SITE[it.item_id] && <Badge tone="accent">{SHOWN_ON_SITE[it.item_id]}</Badge>}
              </span>
            }
          >
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
              <dt className="font-semibold">Notebook cells</dt>
              <dd>{it.source_notebook_cell_indices?.join(', ') ?? '–'} (0-based, all cells)</dd>
              {it.calculation_description && (
                <>
                  <dt className="font-semibold">Description</dt>
                  <dd className="text-ink-soft">{it.calculation_description}</dd>
                </>
              )}
              <dt className="font-semibold">Published files</dt>
              <dd>
                {pub.length === 0 ? (
                  <span className="text-ink-faint">None — this item’s exported files are classified for internal review only.</span>
                ) : (
                  <ul className="list-disc pl-5">
                    {pub.map((p) => (
                      <li key={p}>
                        <a className="link break-all" href={`${DATA_BASE}/${p}`} download>{p}</a>
                      </li>
                    ))}
                  </ul>
                )}
                {(full.unpublished_paths?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-ink-faint">
                    {full.unpublished_paths!.length} further exported file(s) are internal-review artifacts and are not published.
                  </p>
                )}
              </dd>
            </dl>
          </Disclosure>
        );
      })}
    </div>
  );
}
