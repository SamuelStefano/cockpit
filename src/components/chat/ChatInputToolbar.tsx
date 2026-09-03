import { Icon } from '../primitives';
import { ModeToggle } from './ModeToggle';
import { ModelPicker } from './ModelPicker';
import { EffortPicker } from './EffortPicker';
import { BypassToggle } from './BypassToggle';
import { SkillPicker } from './SkillPicker';
import { McpPicker } from './McpPicker';
import { ComposerSummaryChip } from './ComposerSummaryChip';
import type { PermMode, Effort, ModelInfo, Caps, SkillMeta } from '../../../shared/protocol';

interface ChatInputToolbarProps {
  mode: PermMode;
  setMode: (m: PermMode) => void;
  caps: Caps | null;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  skills: SkillMeta[];
  selectedSkills: string[];
  setSelectedSkills: (ids: string[]) => void;
  mcpServers: string[];
  selectedMcps: string[];
  setSelectedMcps: (ids: string[]) => void;
  model: string;
  setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  effort: Effort;
  setEffort: (e: Effort) => void;
  onOpenSettings: () => void;
}

// Nenhum controle daqui é bloqueado por turno rodando: todos viram flag no spawn
// do PRÓXIMO `claude -p`, então travá-los impedia justamente o caso normal —
// preparar o próximo prompt enquanto o atual ainda responde.
export function ChatInputToolbar({ mode, setMode, caps, bypass, setBypass, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, model, setModel, models, onRefreshModels, effort, setEffort, onOpenSettings }: ChatInputToolbarProps) {
  return (
    // No mobile só o modo (o que mais muda) fica inline; o resto vira um chip de
    // resumo que abre o bottom sheet. Antes era uma linha com scroll-x escondido:
    // modelo, esforço e skills ficavam fora da tela sem nenhuma pista de que dava
    // pra rolar. No desktop tudo continua inline.
    <div className="mb-2 flex items-center gap-2 sm:flex-wrap">
      <ModeToggle mode={mode} setMode={setMode} />
      {caps?.canBypass && (
        <span className="hidden sm:inline-flex">
          <BypassToggle on={bypass} setOn={setBypass} />
        </span>
      )}
      {mode === 'auto' && (
        <span className="hidden items-center gap-1 text-[10.5px] text-amber-400/70 sm:flex">
          <Icon name="zap" size={11} /> roda o ciclo sozinho (com shell)
        </span>
      )}
      {mode === 'acceptEdits' && (
        <span className="hidden items-center gap-1 text-[10.5px] text-orange-400/70 sm:flex">
          <Icon name="zap" size={11} /> executa de verdade
        </span>
      )}
      <ComposerSummaryChip
        model={model} models={models} effort={effort} bypass={bypass}
        onClick={onOpenSettings} className="ml-auto sm:hidden"
      />
      <div className="ml-auto hidden shrink-0 items-center gap-x-2 sm:flex sm:min-w-0 sm:max-w-full sm:flex-wrap sm:justify-end sm:gap-y-1.5">
        <McpPicker servers={mcpServers} selected={selectedMcps} setSelected={setSelectedMcps} />
        <SkillPicker skills={skills} selected={selectedSkills} setSelected={setSelectedSkills} />
        <EffortPicker effort={effort} setEffort={setEffort} />
        <ModelPicker model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels} />
      </div>
    </div>
  );
}
