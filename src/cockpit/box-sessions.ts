import { useSyncExternalStore } from 'react';
import type { SessionMeta } from '../../shared/protocol';

// What the other boxes' peeks last listed, for search across boxes.
let byBox: Record<string, SessionMeta[]> = {};
const listeners = new Set<() => void>();
const emit = () => { for (const fn of listeners) fn(); };

export const boxSessionsStore = {
  get: () => byBox,
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  set(box: string, sessions: SessionMeta[]): void {
    if (byBox[box] === sessions) return;
    byBox = { ...byBox, [box]: sessions };
    emit();
  },
  retain(boxes: ReadonlySet<string>): void {
    const kept = Object.entries(byBox).filter(([id]) => boxes.has(id));
    if (kept.length === Object.keys(byBox).length) return;
    byBox = Object.fromEntries(kept);
    emit();
  },
};

export function useBoxSessions(): Record<string, SessionMeta[]> {
  return useSyncExternalStore(boxSessionsStore.subscribe, boxSessionsStore.get);
}
