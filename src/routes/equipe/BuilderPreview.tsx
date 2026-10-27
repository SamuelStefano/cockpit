import type { SkillMeta } from '../../../shared/protocol';
import type { BuilderDraft } from '../../../shared/agent-builder';
import { SkillToggles } from './SkillToggles';

interface BuilderPreviewProps {
  draft: BuilderDraft;
  skills: SkillMeta[];
  onToggle: (id: string) => void;
}

export function BuilderPreview({ draft, skills, onToggle }: BuilderPreviewProps) {
  const empty = !draft.name && !draft.label && !draft.instructions.trim();
  return (
    <section aria-label="Prévia do agente" className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Prévia</h3>
      {empty ? (
        <p className="text-[13px] text-neutral-500">Conforme vocês conversam, o agente aparece aqui.</p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-medium text-neutral-100">{draft.name || 'sem nome ainda'}</p>
          {draft.label && <p className="text-[13px] text-neutral-400">{draft.label}</p>}
          {draft.instructions && <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-300">{draft.instructions}</p>}
        </div>
      )}
      <div>
        <h4 className="pb-1 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">O que ele sabe fazer</h4>
        <SkillToggles skills={skills} enabled={draft.skills} onToggle={onToggle} />
      </div>
    </section>
  );
}
