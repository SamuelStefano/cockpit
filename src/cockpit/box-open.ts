import { useEffect } from 'react';
import { loadPref, savePref } from '../lib/persist';
import { chatPath } from '../useRoute';
import { useBoxes } from './useBoxes';

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

export function openBox(id: string, active: string | null, switchBox: (id: string) => void): void {
  if (id === active) return;
  const path = railTargetPath(location.pathname, loadPref<Record<string, string>>(LAST_SESSION_PREF, {})[id]);
  if (path) history.pushState(null, '', path);
  switchBox(id);
}

export function useRememberLastSession(activeSessionId: string): void {
  const { active } = useBoxes();
  useEffect(() => {
    const prev = loadPref<Record<string, string>>(LAST_SESSION_PREF, {});
    const next = rememberSession(prev, active, activeSessionId);
    if (next !== prev) savePref(LAST_SESSION_PREF, next);
  }, [active, activeSessionId]);
}
