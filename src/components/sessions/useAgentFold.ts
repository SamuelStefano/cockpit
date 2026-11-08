import { useCallback, useMemo } from 'react';
import { usePersisted } from '../../lib/persist';
import { foldTeam, type TeamFold } from '../team/fold-team';
import type { TeamEntry } from '../team/team-order';

const ALL_OPEN: TeamFold | null = null;

export function useAgentFold(entries: TeamEntry[], enabled: boolean) {
  const [openIds, setOpenIds] = usePersisted<string[]>('sidebar.agents.open', []);
  const fold = useMemo(() => (enabled ? foldTeam(entries, new Set(openIds)) : ALL_OPEN), [enabled, entries, openIds]);
  const toggle = useCallback((id: string) => {
    setOpenIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }, [setOpenIds]);
  return { visible: fold ? fold.visible : entries, counts: fold?.counts, open: openIds, toggle };
}
