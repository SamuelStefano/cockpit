import { useState } from 'react';
import type { BotPermissions, SkillMeta } from '../../../shared/protocol';
import { Button, Input, RiskBadge } from '../../components/primitives';
import { risksOf, sourceLabel, sourceOf } from '../../lib/skill-view';
import { SKILL_PRESETS, groupBySource, searchSkills, selectedIds, toggleSelection } from './presets';

interface Props {
  skills: SkillMeta[];
  value: string[];
  perms: BotPermissions;
  onChange: (next: string[]) => void;
}

function blocked(s: SkillMeta, perms: BotPermissions): boolean {
  const r = risksOf(s);
  return (r.includes('write') && !perms.write) || (r.includes('net') && !perms.net);
}

export function SkillPicker({ skills, value, perms, onChange }: Props) {
  const [q, setQ] = useState('');
  const on = selectedIds(skills, value);
  const groups = groupBySource(searchSkills(skills, q), sourceOf);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atalhos de skills">
        {SKILL_PRESETS.map((p) => (
          <Button key={p.id} type="button" size="sm" variant="secondary" onClick={() => onChange(p.pick(skills))}>{p.label}</Button>
        ))}
      </div>
      <Input aria-label="Buscar skill" placeholder="Buscar skill" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="text-[12px] text-neutral-500">{value.length === 0 ? `Todas as ${skills.length} ligadas` : `${on.size} de ${skills.length} ligadas · as outras ficam bloqueadas`}</p>
      <div className="max-h-80 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
        {groups.length === 0 && <p className="px-3 py-3 text-[13px] text-neutral-500">Nenhuma skill encontrada.</p>}
        {groups.map(([source, items]) => (
          <div key={source}>
            <div className="border-t border-neutral-800 px-3 py-1.5 text-[11px] uppercase tracking-wide text-neutral-500 first:border-t-0">{sourceLabel(source)}</div>
            {items.map((s) => (
              <label key={s.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 border-t border-neutral-800/60 px-3 py-1.5">
                <input type="checkbox" aria-label={s.name} checked={on.has(s.id)} onChange={() => onChange(toggleSelection(skills, value, s.id))} className="accent-orange-500" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-200">{s.name}</span>
                {blocked(s, perms) && <span className="text-[11px] text-amber-400">bloqueada pelas permissões</span>}
                {risksOf(s).map((r) => <RiskBadge key={r} risk={r} />)}
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
