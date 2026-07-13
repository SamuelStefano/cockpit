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
  disabled: boolean;
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

export function ChatInputToolbar({ mode, setMode, disabled, caps, bypass, setBypass, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, model, setModel, models, onRefreshModels, effort, setEffort }: ChatInputToolbarProps) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <ModeToggle mode={mode} setMode={setMode} disabled={disabled} />
      {caps?.canBypass && (
        <BypassToggle on={bypass} setOn={setBypass} disabled={disabled} />
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
      {/* min-w-0 + wrap interno: em 390px o cluster quebra em 2 linhas em vez de
          estourar a tela (o select "versão" ficava cortado na borda direita). */}
      <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-1.5">
        <McpPicker servers={mcpServers} selected={selectedMcps} setSelected={setSelectedMcps} />
        <SkillPicker skills={skills} selected={selectedSkills} setSelected={setSelectedSkills} />
        <EffortPicker effort={effort} setEffort={setEffort} disabled={disabled} />
        <ModelPicker model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels} disabled={disabled} />
      </div>
    </div>
  );
}
