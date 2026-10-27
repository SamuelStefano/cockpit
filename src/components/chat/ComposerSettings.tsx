import { ModeToggle } from './ModeToggle';
import { EffortPicker } from './EffortPicker';
import { SkillPicker } from './SkillPicker';
import { McpPicker } from './McpPicker';
import { BypassToggle } from './BypassToggle';
import { isAgentModel } from '../../../shared/agents';
import type { PermMode, Effort, Caps, SkillMeta } from '../../../shared/protocol';

export interface ComposerSettingsProps {
  mode: PermMode;
  setMode: (m: PermMode) => void;
  caps: Caps | null;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  model: string;
  effort: Effort;
  setEffort: (e: Effort) => void;
  skills: SkillMeta[];
  selectedSkills: string[];
  setSelectedSkills: (ids: string[]) => void;
  mcpServers: string[];
  selectedMcps: string[];
  setSelectedMcps: (ids: string[]) => void;
  onRefreshModels: () => void;
  modelLocked?: string;
}

const row = 'flex items-center justify-between gap-3 px-3 py-2';
const label = 'text-[13px] text-neutral-300';

// The "Ajustes" section of the + menu. Nothing here blocks on a running turn: each
// control becomes a flag on the NEXT `claude -p` spawn.
export function ComposerSettings(p: ComposerSettingsProps) {
  // An ACP agent brings its own tools and reasoning: MCPs, Claude skills and
  // effort are never passed to it, so offering them would be a lie.
  const claude = !isAgentModel(p.model);
  return (
    <section aria-label="Ajustes" className="border-t border-neutral-800 py-1">
      <h3 className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Ajustes</h3>
      <div className={row}><span className={label}>Modo</span><ModeToggle mode={p.mode} setMode={p.setMode} /></div>
      {claude && (
        <>
          <div className={row}><span className={label}>Pensar</span><EffortPicker effort={p.effort} setEffort={p.setEffort} /></div>
          <div className={row}>
            <span className={label}>Contexto</span>
            <div className="flex items-center gap-2">
              <SkillPicker skills={p.skills} selected={p.selectedSkills} setSelected={p.setSelectedSkills} />
              <McpPicker servers={p.mcpServers} selected={p.selectedMcps} setSelected={p.setSelectedMcps} />
            </div>
          </div>
        </>
      )}
      {p.caps?.canBypass && <div className={row}><span className={label}>Permissões</span><BypassToggle on={p.bypass} setOn={p.setBypass} /></div>}
      {!p.modelLocked && (
        <button type="button" onClick={p.onRefreshModels} className={`${row} w-full text-left text-[12px] text-neutral-500 transition hover:bg-neutral-800/60 hover:text-neutral-300`}>
          Buscar modelos novos
        </button>
      )}
    </section>
  );
}
