import type { PrChecks, PrDetail, PrSummary } from '../../../shared/prs';
import { EmptyState } from '../../components/primitives/EmptyState';
import { relativeTime } from './prs-view';

const DOT: Record<PrChecks, { cls: string; label: string }> = {
  success: { cls: 'bg-green-400', label: 'CI ok' },
  failure: { cls: 'bg-red-400', label: 'CI falhou' },
  pending: { cls: 'bg-yellow-400', label: 'CI rodando' },
  none: { cls: 'bg-neutral-700', label: 'sem CI' },
};

export function PrCommitsTab({ pr, detail }: { pr: PrSummary; detail: PrDetail }) {
  if (!detail.commits.length) return <EmptyState size="xs" title="Nenhum commit" />;
  return (
    <div className="max-w-3xl space-y-2">
      <ol className="divide-y divide-neutral-800/80 rounded-xl border border-neutral-800">
        {detail.commits.map((c) => (
          <li key={c.sha}>
            <a href={`${pr.url}/commits/${c.sha}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3 py-2 transition hover:bg-neutral-900">
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[c.checks].cls}`} title={DOT[c.checks].label} aria-label={DOT[c.checks].label} role="img" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-neutral-100">{c.title}</span>
                <span className="block truncate text-[12px] text-neutral-500">{c.author} · {relativeTime(c.committedAt)}</span>
              </span>
              <span className="shrink-0 font-mono text-[12px] text-neutral-500">{c.sha.slice(0, 7)}</span>
            </a>
          </li>
        ))}
      </ol>
      {detail.commitCount > detail.commits.length && <p className="text-[12px] text-neutral-500">Mostrando os {detail.commits.length} mais recentes de {detail.commitCount}.</p>}
    </div>
  );
}
