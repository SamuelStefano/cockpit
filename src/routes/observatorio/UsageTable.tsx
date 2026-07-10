import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SessionUsage } from '../../../shared/protocol';
import { Icon } from '../../components/primitives';
import { UsageRow } from './UsageRow';
import { sortUsage, type UsageSortKey, type SortDir } from './usage-sort';

interface UsageTableProps {
  rows: SessionUsage[];
  known: Set<string>;
  titleOf: (id: string) => string;
  onOpenSession: (id: string) => void;
}

export function UsageTable({ rows, known, titleOf, onOpenSession }: UsageTableProps) {
  const maxOut = Math.max(1, ...rows.map((r) => r.outputTokens));
  const [sort, setSort] = useState<{ key: UsageSortKey; dir: SortDir }>({ key: 'cost', dir: 'desc' });
  const sorted = useMemo(() => sortUsage(rows, sort.key, sort.dir), [rows, sort]);

  const toggle = (key: UsageSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  const SortHead = ({ label, sortKey, align = 'left' }: { label: ReactNode; sortKey: UsageSortKey; align?: 'left' | 'right' }) => (
    <th className={`px-3 py-2 font-medium ${align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={() => toggle(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-neutral-300 ${sort.key === sortKey ? 'text-neutral-300' : ''}`}
      >
        {label}
        <Icon name={sort.key === sortKey ? (sort.dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'chevronDown'} size={11} className={sort.key === sortKey ? 'text-orange-400' : 'text-neutral-700'} />
      </button>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/40 text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <th className="px-3 py-2 font-medium">sessão</th>
            <th className="px-3 py-2 font-medium">contexto</th>
            <SortHead label="saída" sortKey="output" />
            <SortHead label="custo" sortKey="cost" />
            <th className="hidden px-3 py-2 font-medium sm:table-cell">amostras</th>
            <SortHead label="visto" sortKey="seen" align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
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
    </div>
  );
}
