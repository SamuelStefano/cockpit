import { useState } from 'react';
import { Icon, tokens } from '../primitives';
import { ModeToggle } from './ModeToggle';
import { isAgentModel } from '../../../shared/agents';
import { ALL_MCPS, isAllMcps } from '../../../shared/mcp';
import type { PermMode, Effort, Caps } from '../../../shared/protocol';

export interface ComposerSettingsProps {
  mode: PermMode;
  setMode: (m: PermMode) => void;
  caps?: Caps | null;
  model: string;
  effort: Effort;
  setEffort: (e: Effort) => void;
  mcpServers: string[];
  selectedMcps: string[];
  setSelectedMcps: (ids: string[]) => void;
}

const row = `flex min-h-10 w-full items-center gap-2.5 px-3 py-2 pointer-coarse:min-h-11 text-left text-[13px] text-neutral-200 transition hover:bg-neutral-800/60 ${tokens.focusRing}`;

function Track({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`relative ml-auto h-4 w-7 shrink-0 rounded-full transition ${on ? 'bg-orange-500/80' : 'bg-neutral-700'}`}>
      <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
    </span>
  );
}

const thinksMore = (e: Effort) => e === 'high' || e === 'xhigh' || e === 'max';

function Tools({ servers, selected, setSelected }: { servers: string[]; selected: string[]; setSelected: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const all = isAllMcps(selected);
  const known = new Set(servers);
  const count = all ? servers.length : selected.filter((id) => known.has(id)).length;
  const toggle = (id: string) => {
    if (all) { setSelected(servers.filter((x) => x !== id)); return; }
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={row}>
        <Icon name="wrench" size={14} className="text-neutral-500" /> Ferramentas
        <span className="ml-auto flex items-center gap-1 text-[12px] text-neutral-500">
          {count > 0 ? `${count} ${count === 1 ? 'ligada' : 'ligadas'}` : 'nenhuma'}
          <Icon name="chevronRight" size={12} className={open ? 'rotate-90 transition' : 'transition'} />
        </span>
      </button>
      {open && (
        <div className="scroll-thin max-h-48 overflow-y-auto border-t border-neutral-800/70 pb-1">
          {servers.length === 0 && <p className="px-3 py-2 text-[12px] text-neutral-500">Nenhuma ferramenta configurada nesta máquina.</p>}
          {servers.length > 0 && (
            <button type="button" role="switch" aria-checked={all} onClick={() => setSelected(all ? [] : [ALL_MCPS])} className={`${row} pl-9 text-neutral-400`}>
              Todas <Track on={all} />
            </button>
          )}
          {servers.map((s) => {
            const on = all || selected.includes(s);
            return (
              <button key={s} type="button" role="switch" aria-checked={on} onClick={() => toggle(s)} className={`${row} pl-9`}>
                <span className="min-w-0 truncate">{s}</span> <Track on={on} />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

export function ComposerSettings(p: ComposerSettingsProps) {
  const claude = !isAgentModel(p.model);
  const deep = thinksMore(p.effort);
  return (
    <section aria-label="Ajustes" className="border-t border-neutral-800 py-1">
      <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-neutral-500">Modo</div>
      <div className="px-3 pb-2"><ModeToggle mode={p.mode} setMode={p.setMode} /></div>
      {claude && (
        <>
          <button type="button" role="switch" aria-checked={deep} aria-label="Pensar mais" onClick={() => p.setEffort(deep ? 'low' : 'high')} className={row}>
            <Icon name="brain" size={14} className="text-neutral-500" /> Pensar mais <Track on={deep} />
          </button>
          <Tools servers={p.mcpServers} selected={p.selectedMcps} setSelected={p.setSelectedMcps} />
        </>
      )}
    </section>
  );
}
