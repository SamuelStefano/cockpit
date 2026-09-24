import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SessionUsage } from '../../../shared/protocol';
import { Button, Icon } from '../../components/primitives';
import { UsageRow } from './UsageRow';
import { sortUsage, type UsageSortKey, type SortDir } from './usage-sort';

interface UsageTableProps {
  rows: SessionUsage[];
  known: Set<string>;
  titleOf: (id: string) => string;
  onOpenSession: (id: string) => void;
}

// Every session since the start of the log is a row; hundreds of them rendered
// at once made /uso slow on a phone. Show a page, grow on demand.
export const USAGE_PAGE = 50;

export function UsageTable({ rows, known, titleOf, onOpenSession }: UsageTableProps) {
  const maxOut = Math.max(1, ...rows.map((r) => r.outputTokens));
  const [sort, setSort] = useState<{ key: UsageSortKey; dir: SortDir }>({ key: 'cost', dir: 'desc' });
  const sorted = useMemo(() => sortUsage(rows, sort.key, sort.dir), [rows, sort]);
  const [limit, setLimit] = useState(USAGE_PAGE);
  const hidden = sorted.length - limit;

  const toggle = (key: UsageSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 hairline">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/40 text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <th className="px-2 py-2 font-medium sm:px-3">sessão</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">contexto</th>
            <SortHead label="saída" sortKey="output" sort={sort} onToggle={toggle} />
            <SortHead label="custo" sortKey="cost" sort={sort} onToggle={toggle} />
            <th className="hidden px-3 py-2 font-medium lg:table-cell">amostras</th>
            <SortHead label="visto" sortKey="seen" align="right" sort={sort} onToggle={toggle} />
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, limit).map((r) => (
            <UsageRow
              key={r.sessionId}
              row={r}
              maxOut={maxOut}
              title={titleOf(r.sessionId)}
              openable={known.has(r.sessionId)}
              onOpen={() => onOpenSession(r.sessionId)}
            />
          ))}
        </tbody>
      </table>
      {hidden > 0 && (
        <div className="flex justify-center border-t border-neutral-800 py-2">
          <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + USAGE_PAGE)}>
            ver mais ({hidden} restante{hidden > 1 ? 's' : ''})
          </Button>
        </div>
      )}
    </div>
  );
}

// Module-level, not declared inside UsageTable: a component type created per
// render made React unmount and remount the header buttons on every sort click,
// dropping keyboard focus after Enter/Space.
function SortHead({ label, sortKey, align = 'left', sort, onToggle }: {
  label: ReactNode; sortKey: UsageSortKey; align?: 'left' | 'right';
  sort: { key: UsageSortKey; dir: SortDir }; onToggle: (k: UsageSortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={`px-2 py-2 font-medium sm:px-3 ${align === 'right' ? 'text-right' : ''}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        onClick={() => onToggle(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors pointer-coarse:-my-2 pointer-coarse:py-2.5 hover:text-neutral-300 ${active ? 'text-neutral-300' : ''}`}
      >
        {label}
        <Icon name={active ? (sort.dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'chevronDown'} size={11} className={active ? 'text-orange-400' : 'text-neutral-700'} />
      </button>
    </th>
  );
}
