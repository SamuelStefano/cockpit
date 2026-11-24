import { useSyncExternalStore } from 'react';
import { loadPref, savePref } from '../lib/persist';
import { computeUpdated } from './signals';

export interface UnreadSession { id: string; mtime: number; waiting?: boolean; lastTurnOk?: boolean }
export interface BoxUnread { white: number; red: number; locked: boolean }

export const NO_UNREAD: BoxUnread = { white: 0, red: 0, locked: false };

// Session ids are unique per box, but the merge prunes what the current list lacks:
// one shared map lost every other box's baseline at each switch.
export function seenPrefKey(box: string | null): string {
  return box ? `seen.${box}` : 'seen';
}

export function loadSeen(box: string | null): Record<string, number> {
  const legacy = loadPref<Record<string, number>>('seen', {});
  return box ? loadPref<Record<string, number>>(seenPrefKey(box), legacy) : legacy;
}

export function saveSeen(box: string | null, seen: Record<string, number>): void {
  savePref(seenPrefKey(box), seen);
}

// Red asks for the person (a question or a failed turn) and is what the badge counts.
// White only says something finished.
export function unreadLevels(
  sessions: UnreadSession[],
  seen: Record<string, number>,
  activeId: string,
  running: Set<string>,
  dismissed: ReadonlySet<string>,
): { white: number; red: number } {
  const updated = computeUpdated(sessions, seen, activeId, running);
  let white = 0;
  let red = 0;
  for (const s of sessions) {
    if (s.id === activeId) continue;
    const failed = updated.has(s.id) && s.lastTurnOk === false;
    if ((s.waiting && !dismissed.has(s.id) && !running.has(s.id)) || failed) red++;
    else if (updated.has(s.id)) white++;
  }
  return { white, red };
}

export function totalRed(byBox: Record<string, BoxUnread>): number {
  return Object.values(byBox).reduce((n, u) => n + u.red, 0);
}

let byBox: Record<string, BoxUnread> = {};
const listeners = new Set<() => void>();
const emit = () => { for (const fn of listeners) fn(); };

export const boxUnreadStore = {
  get: () => byBox,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  set(box: string, unread: BoxUnread): void {
    const prev = byBox[box];
    if (prev && prev.white === unread.white && prev.red === unread.red && prev.locked === unread.locked) return;
    byBox = { ...byBox, [box]: unread };
    emit();
  },
  // Offline, revoked or no longer watched: nothing live to claim about that box.
  retain(boxes: ReadonlySet<string>): void {
    const kept = Object.entries(byBox).filter(([id]) => boxes.has(id));
    if (kept.length === Object.keys(byBox).length) return;
    byBox = Object.fromEntries(kept);
    emit();
  },
  reset(): void { byBox = {}; emit(); },
};

export function useBoxUnread(): Record<string, BoxUnread> {
  return useSyncExternalStore(boxUnreadStore.subscribe, boxUnreadStore.get);
}
