import { useEffect, useMemo } from 'react';
import { boxUnreadStore, unreadLevels, type UnreadSession } from '../cockpit/box-unread';
import { useBoxes } from '../cockpit/useBoxes';
import { usePersisted } from '../lib/persist';
import { WAITING_DISMISSED_KEY } from '../lib/prefs';

export function useActiveBoxUnread(sessions: UnreadSession[], seen: Record<string, number>, activeId: string, running: Set<string>): void {
  const { active } = useBoxes();
  const [dismissedMap] = usePersisted<Record<string, number>>(WAITING_DISMISSED_KEY, {});
  const levels = useMemo(
    () => unreadLevels(sessions, seen, activeId, running, new Set(Object.keys(dismissedMap))),
    [sessions, seen, activeId, running, dismissedMap],
  );
  useEffect(() => {
    if (active) boxUnreadStore.set(active, { ...levels, locked: false });
  }, [active, levels]);
}
