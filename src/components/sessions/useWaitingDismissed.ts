import { useCallback, useEffect, useMemo } from 'react';
import { usePersisted } from '../../lib/persist';
import { WAITING_DISMISSED_KEY } from '../../lib/prefs';
import type { Session } from '../../data/types';

// Retira as entradas cuja sessão voltou a perguntar DEPOIS da dispensa: pergunta
// nova merece o topo de novo. Pura pra ser testável sem React.
export function pruneDismissed(map: Record<string, number>, sessions: Session[]): Record<string, number> {
  const revived = sessions.filter((s) => map[s.id] !== undefined && s.waiting && s.mtime > map[s.id]);
  if (revived.length === 0) return map;
  const next = { ...map };
  for (const s of revived) delete next[s.id];
  return next;
}

export function useWaitingDismissed(sessions: Session[]) {
  const [map, setMap] = usePersisted<Record<string, number>>(WAITING_DISMISSED_KEY, {});

  useEffect(() => {
    const next = pruneDismissed(map, sessions);
    if (next !== map) setMap(next);
  }, [map, sessions, setMap]);

  const dismissed = useMemo(() => new Set(Object.keys(map)), [map]);

  const dismissWaiting = useCallback((id: string) => {
    const mtime = sessions.find((s) => s.id === id)?.mtime ?? Date.now();
    setMap((prev) => ({ ...prev, [id]: mtime }));
  }, [sessions, setMap]);

  return { dismissed, dismissWaiting };
}
