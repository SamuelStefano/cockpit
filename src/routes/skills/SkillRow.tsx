import { RiskBadge } from '../../components/primitives';
import type { SkillMeta, TeamBot } from '../../../shared/protocol';
import { risksOf, sourceLabel, sourceOf } from '../../lib/skill-view';
import { UsedByStack } from './UsedByStack';

interface Props { s: SkillMeta; bots: TeamBot[]; onOpen: (id: string) => void }

export function SkillRow({ s, bots, onOpen }: Props) {
  return (
    <button type="button" onClick={() => onOpen(s.id)}
      className="flex min-h-14 w-full flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-neutral-800 px-4 py-2.5 text-left transition-colors first:border-t-0 hover:bg-neutral-800/60 sm:flex-nowrap">
      <span className="min-w-0 basis-full sm:basis-auto sm:flex-1">
        <span className="block truncate text-[14px] font-medium text-neutral-100">{s.name}</span>
        <small className="block truncate text-[12px] text-neutral-500">{s.description || '—'}</small>
      </span>
      <span className="w-32 shrink-0 truncate text-[12px] text-neutral-500 sm:w-36">{sourceLabel(sourceOf(s))}</span>
      <span className="flex min-w-0 flex-1 items-center sm:w-36 sm:flex-none"><UsedByStack ids={s.usedBy ?? []} bots={bots} /></span>
      <span className="flex shrink-0 gap-1 sm:w-28">{risksOf(s).map((r) => <RiskBadge key={r} risk={r} />)}</span>
    </button>
  );
}
