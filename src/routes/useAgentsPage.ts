import { useEffect, useMemo, useState } from 'react';
import { agentModelId } from '../../shared/agents';
import { buildCards, customCards, defaultSelection, sortCards } from '../cockpit/agents-view';
import type { AgentsApi } from '../cockpit/useAgents';
import type { BitState } from '../components/bit/bit-state';
import { useAgentCelebration } from './useAgentCelebration';
import { useTestPhrase } from './useTestPhrase';

export function useAgentsPage(agents: AgentsApi, onOpenChat: (model: string) => void) {
  const { refresh, presets, items, testing, loaded, lastTest } = agents;
  useEffect(() => { refresh(); }, [refresh]);

  const cards = useMemo(() => sortCards([...buildCards(presets, items), ...customCards(presets, items)]), [presets, items]);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    if (picked === null && loaded && cards.length) setPicked(defaultSelection(cards));
  }, [picked, loaded, cards]);

  const selected = cards.find((c) => c.preset.id === picked) ?? null;
  const celebrating = useAgentCelebration(items, loaded);
  const selectedTesting = !!selected && testing.has(selected.item?.id ?? selected.preset.id);
  const phrase = useTestPhrase(selectedTesting);
  const message = selected?.item ? (lastTest?.id === selected.item.id ? lastTest.message : selected.item.detail) : undefined;

  const heroState: BitState = testing.size > 0 ? 'thinking' : items.some((i) => i.status === 'ready') ? 'happy' : 'wave';
  return {
    cards, selected, select: setPicked, celebrating, selectedTesting, phrase, message, heroState,
    isTesting: (id: string) => testing.has(id),
    openChat: (id: string) => onOpenChat(agentModelId(id)),
  };
}
