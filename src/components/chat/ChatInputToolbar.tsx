import { Icon } from '../primitives';
import { ModeToggle } from './ModeToggle';
import { ModelPicker } from './ModelPicker';
import { BypassToggle } from './BypassToggle';
import { SkillPicker } from './SkillPicker';
import type { PermMode, ModelInfo, Caps, SkillMeta } from '../../../shared/protocol';

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
  model: string;
  setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
}

export function ChatInputToolbar({ mode, setMode, disabled, caps, bypass, setBypass, skills, selectedSkills, setSelectedSkills, model, setModel, models, onRefreshModels }: ChatInputToolbarProps) {
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
      <div className="ml-auto flex items-center gap-2">
        <SkillPicker skills={skills} selected={selectedSkills} setSelected={setSelectedSkills} />
        <ModelPicker model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels} disabled={disabled} />
      </div>
    </div>
  );
}
