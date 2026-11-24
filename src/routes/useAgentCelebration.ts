import { useEffect, useRef, useState } from 'react';
import type { AgentStatus, AgentView } from '../../shared/agents';
import { newlyReady } from '../cockpit/agents-view';
import { fireConfetti } from '../components/primitives';

const CELEBRATE_MS = 2500;

export function useAgentCelebration(items: AgentView[], loaded: boolean): string | null {
  const prev = useRef<Record<string, AgentStatus> | null>(null);
  const [celebrating, setCelebrating] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (prev.current) {
      const hit = newlyReady(prev.current, items);
      if (hit.length) { fireConfetti(); setCelebrating(hit[0]); }
    }
    prev.current = Object.fromEntries(items.map((i) => [i.id, i.status]));
  }, [items, loaded]);

  useEffect(() => {
    if (!celebrating) return;
    const t = setTimeout(() => setCelebrating(null), CELEBRATE_MS);
    return () => clearTimeout(t);
  }, [celebrating]);

  return celebrating;
}
