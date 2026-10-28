import { useState } from 'react';
import type { BuilderDraft } from '../../../shared/agent-builder';
import type { ImportedDraft } from '../../../shared/agent-template';
import type { BotDraft } from '../equipe/useBotForm';

export type BuilderPanel = 'builder' | 'template' | null;

// "Criar conversando" and "Compartilhar ou receber" only fill the form: the user
// still reviews and presses Criar/Salvar.
export function useBuilderPanels(patch: (p: Partial<BotDraft>) => void) {
  const [panel, setPanel] = useState<BuilderPanel>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const accept = (b: BuilderDraft) => {
    patch({ name: b.name, label: b.label, instructions: b.instructions, skills: b.skills });
    setNotice(null);
    setPanel(null);
  };
  const imported = (d: ImportedDraft) => {
    patch({ name: d.name, label: d.label, instructions: d.instructions, skills: d.skills, shape: d.shape, color: d.color });
    setNotice(d.missingSkills.length ? `${d.missingSkills.length} skill(s) do agente original não existem aqui e ficaram de fora.` : null);
    setPanel(null);
  };
  return { panel, setPanel, notice, accept, imported };
}
