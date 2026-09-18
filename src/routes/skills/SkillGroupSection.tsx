import type { SkillGroup } from '../../lib/skill-packs';
import { SkillCard } from './SkillCard';

export function SkillGroupSection({ group, onOpen }: { group: SkillGroup; onOpen: (id: string) => void }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {group.label}
        <span className="rounded-full bg-neutral-800 px-1.5 py-px text-[10px] tabular-nums text-neutral-500">{group.items.length}</span>
      </h2>
      <div className="stagger-fade grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.items.map((s) => <SkillCard key={s.id} s={s} onClick={() => onOpen(s.id)} />)}
      </div>
    </section>
  );
}
