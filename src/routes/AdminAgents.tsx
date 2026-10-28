import type { CSSProperties } from 'react';
import { EmptyState } from '../components/primitives';
import type { AgentsApi } from '../cockpit/useAgents';
import type { TermApi } from '../cockpit/useTerminals';
import { VersionsModal } from '../components/versions/VersionsModal';
import { AgentCustomSheet } from './AgentCustomSheet';
import { AgentPanel } from './AgentPanel';
import { AgentTile } from './AgentTile';
import { AgentsHeader } from './AgentsHeader';
import { useAgentsPage } from './useAgentsPage';
import './agents.css';

interface AdminAgentsProps {
  agents: AgentsApi;
  term: TermApi;
  isRoot: boolean;
  onOpenChat: (model: string) => void;
}

export function AdminAgents({ agents, term, isRoot, onOpenChat }: AdminAgentsProps) {
  const page = useAgentsPage(agents, isRoot, onOpenChat);
  const { cards, selected } = page;
  const slot = { '--p1': page.selectedIndex * 2 + 1, '--p2': (page.selectedIndex | 1) * 2 + 1 } as CSSProperties;
  return (
    <div className="flex flex-col gap-5">
      <AgentsHeader state={page.heroState} onAdd={page.openSheet} />
      {agents.loaded && cards.length === 0 ? (
        <EmptyState bit="sleeping" title="Nenhum agente ainda" description="Adicione um CLI que fale ACP e ele vira um modelo no seletor." />
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
                key={selected.preset.id} card={selected} term={term} testing={page.selectedTesting} celebrating={page.celebrating === selected.item?.id}
                phrase={page.phrase} message={page.message}
                onConnect={agents.connect} onTest={agents.test} onRemove={agents.remove} onOpenChat={page.openChat} onVersions={agents.versions.open}
              />
            </div>
          )}
        </div>
      )}
      <VersionsModal api={agents.versions} title={agents.items.find((a) => a.id === agents.versions.id)?.name ?? agents.versions.id ?? ''} canRestore={isRoot && agents.customAllowed} />
      {page.sheetOpen && <AgentCustomSheet agents={agents} gate={page.gate} term={term} onClose={page.closeSheet} onSaved={page.onSaved} />}
    </div>
  );
}
