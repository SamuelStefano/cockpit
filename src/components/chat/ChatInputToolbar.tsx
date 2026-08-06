import { Icon } from '../primitives';
import { ModeToggle } from './ModeToggle';
import { ModelPicker } from './ModelPicker';
import { EffortPicker } from './EffortPicker';
import { BypassToggle } from './BypassToggle';
import { SkillPicker } from './SkillPicker';
import { McpPicker } from './McpPicker';
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
}

// Nenhum controle daqui é bloqueado por turno rodando: todos viram flag no spawn
// do PRÓXIMO `claude -p`, então travá-los impedia justamente o caso normal —
// preparar o próximo prompt enquanto o atual ainda responde.
export function ChatInputToolbar({ mode, setMode, caps, bypass, setBypass, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, model, setModel, models, onRefreshModels, effort, setEffort }: ChatInputToolbarProps) {
  return (
    // No mobile o toolbar vira UMA linha com scroll-x (padrão dos chats grandes)
    // em vez de empilhar 3 linhas; os popovers dos pickers escapam do clipping
    // porque no mobile são bottom-sheets position:fixed.
    <div className="scroll-none mb-2 flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-x-visible">
      <ModeToggle mode={mode} setMode={setMode} />
      {caps?.canBypass && (
        <BypassToggle on={bypass} setOn={setBypass} />
      )}
      {mode === 'auto' && (
        <span className="hidden items-center gap-1 text-[10.5px] text-amber-400/70 sm:flex">
          <Icon name="zap" size={11} /> edita sozinho, sem shell
        </span>
      )}
      {mode === 'acceptEdits' && (
        <span className="hidden items-center gap-1 text-[10.5px] text-orange-400/70 sm:flex">
          <Icon name="zap" size={11} /> executa de verdade
        </span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-x-2 sm:min-w-0 sm:max-w-full sm:flex-wrap sm:justify-end sm:gap-y-1.5">
        <McpPicker servers={mcpServers} selected={selectedMcps} setSelected={setSelectedMcps} />
        <SkillPicker skills={skills} selected={selectedSkills} setSelected={setSelectedSkills} />
        <EffortPicker effort={effort} setEffort={setEffort} />
        <ModelPicker model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels} />
      </div>
    </div>
  );
}
