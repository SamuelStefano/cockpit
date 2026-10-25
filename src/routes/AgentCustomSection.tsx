import { useState } from 'react';
import { Icon } from '../components/primitives';
import type { AgentsApi } from '../cockpit/useAgents';
import { AgentCustomForm } from './AgentCustomForm';
import { AgentCustomManual } from './AgentCustomManual';

export function AgentCustomSection({ agents }: { agents: AgentsApi }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="hairline rounded-xl border border-neutral-800 bg-neutral-900/40">
      <button
        type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500/40"
      >
        <Icon name="plus" size={14} className="text-neutral-500" />
        <span className="text-[13px] font-semibold text-neutral-200">Agente personalizado</span>
        <span className="hidden text-[12px] text-neutral-500 sm:inline">Tem outro CLI que fala ACP? Conecte aqui.</span>
        <Icon name="chevronDown" size={14} className={`ml-auto text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="fade-up border-t border-neutral-800 px-4 py-3">
          {agents.customAllowed ? <AgentCustomForm onAdd={agents.addCustom} /> : <AgentCustomManual />}
        </div>
      )}
    </section>
  );
}
