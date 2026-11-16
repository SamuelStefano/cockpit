import { useCallback, useMemo } from 'react';
import { usePersisted } from '../../lib/persist';
import { foldTeam, glanceEntries } from '../team/fold-team';
import type { TeamEntry } from '../team/team-order';

// The section starts collapsed: a long team pushed the chats below the fold.
export function useAgentFold(entries: TeamEntry[], activeId: string | null) {
  const [expanded, setExpanded] = usePersisted<boolean>('sidebar.agents.section', false);
  const [openIds, setOpenIds] = usePersisted<string[]>('sidebar.agents.open', []);
  const fold = useMemo(() => foldTeam(entries, new Set(openIds)), [entries, openIds]);
  const glance = useMemo(() => glanceEntries(entries, activeId), [entries, activeId]);
  const toggle = useCallback((id: string) => {
    setOpenIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }, [setOpenIds]);
  const toggleSection = useCallback(() => setExpanded((v) => !v), [setExpanded]);
  return {
    expanded, toggleSection,
    visible: expanded ? fold.visible : glance,
    fold: expanded ? { counts: fold.counts, open: openIds, onToggle: toggle } : undefined,
  };
}
