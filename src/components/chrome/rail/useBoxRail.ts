import { useCallback, useEffect, useState } from 'react';
import { loadPref, savePref } from '../../../lib/persist';
import { useBoxUnread } from '../../../cockpit/box-unread';
import { useBoxSwitcher } from '../../sessions/useBoxSwitcher';
import { chatPath } from '../../../useRoute';

export const LAST_SESSION_PREF = 'box.last-session';
const isChatPath = (p: string) => p === '/' || p.startsWith('/c/');

// Leaving a page like /canvas alone keeps the same page on the new box; only the
// chat view follows the box's last conversation.
export function railTargetPath(pathname: string, last: string | undefined): string | null {
  return last && isChatPath(pathname) ? chatPath(last) : null;
}

export function rememberSession(map: Record<string, string>, box: string | null, sessionId: string): Record<string, string> {
  if (!box || !sessionId || sessionId.startsWith('new-') || map[box] === sessionId) return map;
  return { ...map, [box]: sessionId };
}

export interface RailMenu { boxId: string; x: number; y: number }

export function useBoxRail(activeSessionId: string) {
  const s = useBoxSwitcher();
  const [menu, setMenu] = useState<RailMenu | null>(null);
  const unread = useBoxUnread();

  useEffect(() => {
    const prev = loadPref<Record<string, string>>(LAST_SESSION_PREF, {});
    const next = rememberSession(prev, s.active, activeSessionId);
    if (next !== prev) savePref(LAST_SESSION_PREF, next);
  }, [s.active, activeSessionId]);

  const open = useCallback((id: string) => {
    if (id === s.active) return;
    const path = railTargetPath(location.pathname, loadPref<Record<string, string>>(LAST_SESSION_PREF, {})[id]);
    if (path) history.pushState(null, '', path);
    s.select(id);
  }, [s]);

  return { ...s, open, unread, menu, openMenu: setMenu, closeMenu: () => setMenu(null) };
}
