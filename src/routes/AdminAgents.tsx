import type { CSSProperties } from 'react';
import { EmptyState } from '../components/primitives';
import { progressFor } from '../cockpit/agents-view';
import type { AgentsApi } from '../cockpit/useAgents';
import { AgentCustomSection } from './AgentCustomSection';
import { AgentPanel } from './AgentPanel';
import { AgentTile } from './AgentTile';
import { AgentsHero } from './AgentsHero';
import { useAgentsPage } from './useAgentsPage';
import './agents.css';

export function AdminAgents({ agents, onOpenChat }: { agents: AgentsApi; onOpenChat: (model: string) => void }) {
  const page = useAgentsPage(agents, onOpenChat);
  const { cards, selected } = page;
  const selectedIndex = cards.findIndex((c) => c === selected);
  const slot = { '--p1': selectedIndex * 2 + 1, '--p2': (selectedIndex | 1) * 2 + 1 } as CSSProperties;
  return (
    <div className="flex flex-col gap-5">
      <AgentsHero state={page.heroState} done={selected ? progressFor(selected.status, !!selected.item) : 0} />
      {agents.loaded && cards.length === 0 ? (
        <EmptyState bit="sleeping" title="Nenhum agente disponível" description="O servidor não devolveu nenhum agente pré-configurado." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((c, i) => (
            <AgentTile
              key={c.preset.id} card={c} index={i} selected={c === selected}
              testing={page.isTesting(c.item?.id ?? c.preset.id)} celebrating={page.celebrating === c.item?.id}
              onSelect={() => page.select(c.preset.id)}
            />
          ))}
          {selected && (
            <div className="agent-panel-slot col-span-full" style={slot}>
              <AgentPanel
                key={selected.preset.id} card={selected} testing={page.selectedTesting} celebrating={page.celebrating === selected.item?.id}
                phrase={page.phrase} message={page.message}
                onConnect={agents.connect} onTest={agents.test} onRemove={agents.remove} onOpenChat={page.openChat}
              />
            </div>
          )}
        </div>
      )}
      <AgentCustomSection agents={agents} />
    </div>
  );
}
