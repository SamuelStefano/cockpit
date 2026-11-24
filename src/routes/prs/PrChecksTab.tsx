import type { PrCheckRun, PrDetail } from '../../../shared/prs';
import { EmptyState } from '../../components/primitives/EmptyState';

const STATE: Record<PrCheckRun['state'], { label: string; cls: string }> = {
  success: { label: 'ok', cls: 'text-green-400' },
  failure: { label: 'falhou', cls: 'text-red-400' },
  pending: { label: 'rodando', cls: 'text-yellow-400' },
  skipped: { label: 'pulado', cls: 'text-neutral-500' },
};

export function PrChecksTab({ detail }: { detail: PrDetail }) {
  if (!detail.checkRuns.length) return <EmptyState size="xs" title="Nenhum check nesta PR" />;
  return (
    <ul className="divide-y divide-neutral-800/80 rounded-xl border border-neutral-800">
      {detail.checkRuns.map((c) => (
        <li key={c.name} className="flex items-center gap-2 px-3 py-2">
          <span className={`shrink-0 text-[12px] font-medium ${STATE[c.state].cls}`}>{STATE[c.state].label}</span>
          {c.url
            ? <a href={c.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] text-neutral-200 hover:text-orange-300">{c.name}</a>
            : <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-200">{c.name}</span>}
        </li>
      ))}
    </ul>
  );
}
