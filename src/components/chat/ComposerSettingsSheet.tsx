import { Icon, tokens } from '../primitives';
import { ModelPicker } from './ModelPicker';
import { EffortPicker } from './EffortPicker';
import { SkillPicker } from './SkillPicker';
import { McpPicker } from './McpPicker';
import { BypassToggle } from './BypassToggle';
import { useDismiss } from './useDismiss';
import type { Effort, ModelInfo, Caps, SkillMeta } from '../../../shared/protocol';

interface ComposerSettingsSheetProps {
  onClose: () => void;
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

const row = 'flex items-center justify-between gap-3 border-b border-neutral-800/70 px-4 py-3 last:border-b-0';
const label = 'text-[12.5px] font-medium text-neutral-300';

// Tudo que saiu da barra no celular (A4): modelo, esforço, skills, MCP e bypass.
// Bottom sheet no mesmo padrão do McpPicker. Só existe abaixo de `sm` — no desktop
// a barra continua mostrando os pickers inline.
export function ComposerSettingsSheet({ onClose, caps, bypass, setBypass, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, model, setModel, models, onRefreshModels, effort, setEffort }: ComposerSettingsSheetProps) {
  const ref = useDismiss<HTMLDivElement>(true, onClose);
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40 sm:hidden" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-label="Ajustes do próximo prompt"
        className="fixed inset-x-0 bottom-0 z-40 max-h-[70dvh] overflow-y-auto overscroll-contain rounded-t-2xl border border-neutral-700 bg-neutral-900 pb-[env(safe-area-inset-bottom)] shadow-xl shadow-black/50 sm:hidden"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <span className="text-[13px] font-semibold text-neutral-100">Ajustes do próximo prompt</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ajustes"
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 ${tokens.focusRing}`}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className={row}>
          <span className={label}>Modelo</span>
          <ModelPicker model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels} />
        </div>
        <div className={row}>
          <span className={label}>Pensar</span>
          <EffortPicker effort={effort} setEffort={setEffort} />
        </div>
        <div className={row}>
          <span className={label}>Contexto</span>
          <div className="flex items-center gap-2">
            <SkillPicker skills={skills} selected={selectedSkills} setSelected={setSelectedSkills} />
            <McpPicker servers={mcpServers} selected={selectedMcps} setSelected={setSelectedMcps} />
          </div>
        </div>
        {caps?.canBypass && (
          <div className={row}>
            <span className={label}>Permissões</span>
            <BypassToggle on={bypass} setOn={setBypass} />
          </div>
        )}
      </div>
    </>
  );
}
