import type { PrSummary } from '../../../shared/prs';
import { PrBadges } from './PrBadges';
import { relativeTime, repoName } from './prs-view';

interface PrRowProps { pr: PrSummary; active: boolean; onSelect: (url: string) => void }

export function PrRow({ pr, active, onSelect }: PrRowProps) {
  const when = relativeTime(pr.mergedAt ?? pr.updatedAt);
  return (
    <button
      type="button" onClick={() => onSelect(pr.url)} aria-current={active}
      className={`block w-full rounded-xl border px-3 py-2.5 text-left transition ${
        active ? 'border-orange-500/40 bg-orange-500/6' : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'}`}
    >
      <span className="block truncate text-[14px] font-medium text-neutral-100">{pr.title}</span>
      <span className="mt-0.5 block truncate font-mono text-[12px] text-neutral-500">
        #{pr.number} · {repoName(pr.repo)} · {when}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1">
        <PrBadges pr={pr} />
        <span className="ml-auto font-mono text-[12px]">
          <span className="text-green-400">+{pr.additions}</span> <span className="text-red-400">−{pr.deletions}</span>
        </span>
      </span>
    </button>
  );
}
