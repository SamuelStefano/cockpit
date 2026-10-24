import { useEffect, useMemo } from 'react';
import { EmptyState } from '../components/primitives';
import { buildCards } from '../cockpit/agents-view';
import type { AgentsApi } from '../cockpit/useAgents';
import { AgentCard } from './AgentCard';
import { AgentCustomSection } from './AgentCustomSection';

export function AdminAgents({ agents }: { agents: AgentsApi }) {
  const { refresh, presets, items } = agents;
  useEffect(() => { refresh(); }, [refresh]);
  const cards = useMemo(() => buildCards(presets, items), [presets, items]);
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-[12.5px] leading-relaxed text-neutral-400 hairline">
        <p>Agente é outro assistente de código (Grok, Gemini, Codex…) que roda na VPS com o login do próprio CLI. O Grok, por exemplo, usa a sua assinatura SuperGrok, sem chave de API.</p>
        <p className="mt-1 text-neutral-300">Escolha um, siga os 3 passos, clique em Testar. Os comandos rodam num Terminal do Deck.</p>
      </div>
      {agents.loaded && cards.length === 0 ? (
        <EmptyState icon="terminal" title="Nenhum agente disponível" description="O servidor não devolveu nenhum agente pré-configurado." />
      ) : (
        cards.map((c) => (
          <AgentCard key={c.preset.id} card={c} testing={agents.testing.has(c.item?.id ?? c.preset.id)} lastTest={agents.lastTest} onConnect={agents.connect} onTest={agents.test} onRemove={agents.remove} />
        ))
      )}
      <AgentCustomSection agents={agents} />
    </div>
  );
}
