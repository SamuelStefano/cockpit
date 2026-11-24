import type { SkillMeta, TeamBot } from '../../../shared/protocol';
import { EmptyState } from '../../components/primitives';
import { SkillRow } from './SkillRow';

interface Props { skills: SkillMeta[]; bots: TeamBot[]; onOpen: (id: string) => void }

export function InstalledView({ skills, bots, onOpen }: Props) {
  if (skills.length === 0) return <EmptyState size="sm" icon="search" title="Nada com esses filtros" description="Tire um filtro ou mude a busca." />;
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
      <div className="hidden items-center gap-4 border-b border-neutral-800 px-4 py-2 text-[12px] uppercase tracking-wide text-neutral-500 sm:flex">
        <span className="flex-1">Skill</span><span className="w-36">Fonte</span><span className="w-36">Usada por</span><span className="w-28">Risco</span>
      </div>
      {skills.map((s) => <SkillRow key={s.id} s={s} bots={bots} onOpen={onOpen} />)}
    </div>
  );
}
