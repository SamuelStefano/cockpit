import { useState } from 'react';
import { Button } from '../components/primitives';
import { customItems } from '../cockpit/agents-view';
import type { AgentsApi } from '../cockpit/useAgents';
import { AgentCustomForm } from './AgentCustomForm';
import { AgentCustomManual } from './AgentCustomManual';
import { AgentCustomRow } from './AgentCustomRow';

export function AgentCustomSection({ agents }: { agents: AgentsApi }) {
  const [open, setOpen] = useState(false);
  const rows = customItems(agents.presets, agents.items);
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 hairline">
      <h3 className="text-[14px] font-semibold text-neutral-100">Agente personalizado</h3>
      <p className="mb-3 mt-1 text-[12.5px] text-neutral-400">Tem outro CLI que fala ACP? Conecte aqui.</p>
      {rows.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {rows.map((i) => <AgentCustomRow key={i.id} item={i} testing={agents.testing.has(i.id)} onTest={agents.test} onRemove={agents.remove} />)}
        </ul>
      )}
      {!agents.customAllowed ? (
        <AgentCustomManual />
      ) : open ? (
        <AgentCustomForm onAdd={agents.addCustom} />
      ) : (
        <Button variant="secondary" size="sm" icon="plus" onClick={() => setOpen(true)}>Adicionar personalizado</Button>
      )}
    </section>
  );
}
