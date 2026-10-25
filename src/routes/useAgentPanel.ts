import { useCallback, useState } from 'react';
import { agentTermId, type AgentStepKind } from '../../shared/agents';
import { progressFor, type AgentCardModel } from '../cockpit/agents-view';
import type { TermApi } from '../cockpit/useTerminals';
import { useAgentTerminal } from './useAgentTerminal';

interface PanelDeps {
  term: TermApi;
  onConnect: (preset: string) => void;
  onTest: (id: string) => void;
}

export function useAgentPanel(card: AgentCardModel, { term, onConnect, onTest }: PanelDeps) {
  const { preset, item, status } = card;
  const agentId = item?.id ?? preset.id;
  const [confirming, setConfirming] = useState(false);
  // Closing a step is what re-checks: the badge moves on without a click.
  const terminal = useAgentTerminal(term, agentTermId(agentId), useCallback(() => onTest(agentId), [onTest, agentId]));
  const ready = status === 'ready' && !!item;
  const run = useCallback((kind: AgentStepKind, command: string) => {
    if (!item) onConnect(preset.id);
    terminal.run(kind, command);
  }, [item, onConnect, preset.id, terminal]);
  return {
    terminal, ready, confirming, setConfirming, run,
    done: progressFor(status, !!item),
    current: ready ? null : item ? card.activeStep : 0,
    test: () => onTest(agentId),
  };
}
