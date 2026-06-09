import type { SessionUsage } from '../../../shared/protocol';
import { UsageRow } from './UsageRow';

interface UsageTableProps {
  rows: SessionUsage[];
  known: Set<string>;
  titleOf: (id: string) => string;
  onOpenSession: (id: string) => void;
}

export function UsageTable({ rows, known, titleOf, onOpenSession }: UsageTableProps) {
  const maxOut = Math.max(1, ...rows.map((r) => r.outputTokens));
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/40 text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <th className="px-3 py-2 font-medium">sessão</th>
            <th className="px-3 py-2 font-medium">contexto</th>
            <th className="px-3 py-2 font-medium">saída</th>
            <th className="px-3 py-2 font-medium">custo</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">amostras</th>
            <th className="px-3 py-2 text-right font-medium">visto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
