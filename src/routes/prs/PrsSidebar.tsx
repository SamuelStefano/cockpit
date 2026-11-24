import type { OrgGroup, PrFilter } from './prs-view';

interface PrsSidebarProps {
  orgs: OrgGroup[];
  total: number;
  filter: PrFilter;
  onChange: (f: PrFilter) => void;
  horizontal: boolean;
}

const base = 'rounded-lg px-2.5 py-1.5 text-left text-[13px] transition';
const cls = (on: boolean) => `${base} ${on ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}`;

export function PrsSidebar({ orgs, total, filter, onChange, horizontal }: PrsSidebarProps) {
  const none = !filter.org && !filter.repo;
  if (horizontal) {
    const chips = orgs.flatMap((o) => o.repos);
    return (
      <div className="scroll-thin flex shrink-0 gap-1.5 overflow-x-auto border-b border-neutral-800/80 px-3 py-2">
        <button type="button" onClick={() => onChange({ org: null, repo: null })} className={`shrink-0 whitespace-nowrap ${cls(none)}`}>Todos {total}</button>
        {chips.map((r) => (
          <button key={r.repo} type="button" onClick={() => onChange({ org: null, repo: r.repo })} className={`shrink-0 whitespace-nowrap ${cls(filter.repo === r.repo)}`}>
            {r.name} {r.count}
          </button>
        ))}
      </div>
    );
  }
  return (
    <nav aria-label="Repositórios" className="scroll-thin flex w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-neutral-800/80 p-2">
      <button type="button" onClick={() => onChange({ org: null, repo: null })} className={`flex justify-between ${cls(none)}`}>
        <span>Todos</span><span className="text-neutral-500">{total}</span>
      </button>
      {orgs.map((o) => (
        <div key={o.org} className="mt-2">
          <button type="button" onClick={() => onChange({ org: o.org, repo: null })}
            className={`flex w-full justify-between text-[11px] font-medium uppercase tracking-[0.06em] ${cls(filter.org === o.org && !filter.repo)}`}>
            <span className="truncate">{o.org}</span><span>{o.total}</span>
          </button>
          {o.repos.map((r) => (
            <button key={r.repo} type="button" onClick={() => onChange({ org: o.org, repo: r.repo })} className={`flex w-full justify-between pl-4 ${cls(filter.repo === r.repo)}`}>
              <span className="truncate">{r.name}</span><span className="text-neutral-500">{r.count}</span>
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
