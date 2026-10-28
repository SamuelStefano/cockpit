import type { SkillMeta } from '../../../shared/protocol';
import { skillBlurb } from '../../../shared/agent-builder';
import { Switch } from '../../components/primitives';

interface SkillTogglesProps {
  skills: SkillMeta[];
  enabled: string[];
  onToggle: (id: string) => void;
}

export function SkillToggles({ skills, enabled, onToggle }: SkillTogglesProps) {
  if (skills.length === 0) return <p className="text-[13px] text-neutral-500">Nenhuma habilidade extra disponível por aqui.</p>;
  return (
    <div className="flex flex-col gap-1">
      {skills.map((s) => (
        <Switch key={s.id} checked={enabled.includes(s.id)} onChange={() => onToggle(s.id)} label={s.name} hint={skillBlurb(s)} />
      ))}
      <p className="pt-1 text-[12px] text-neutral-500">Nenhuma ligada = o agente pode usar todas.</p>
    </div>
  );
}
