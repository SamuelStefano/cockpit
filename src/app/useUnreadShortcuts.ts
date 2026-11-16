import { useEffect, useRef } from 'react';
import { boxUnreadStore, type BoxUnread } from '../cockpit/box-unread';
import { useBoxes } from '../cockpit/useBoxes';
import { sortBoxes } from '../components/sessions/useBoxSwitcher';
import { openBox } from '../cockpit/box-open';
import { inDesktopApp } from '../lib/desktop';
import type { Session } from '../data/types';
import type { Route } from '../useRoute';

export function nextUnreadSession(ordered: Session[], activeId: string, unread: ReadonlySet<string>, dir: 1 | -1): string | null {
  const n = ordered.length;
  if (!n) return null;
  const start = ordered.findIndex((s) => s.id === activeId);
  for (let k = 1; k <= n; k++) {
    const i = (((start < 0 ? (dir > 0 ? -1 : 0) : start) + dir * k) % n + n) % n;
    if (ordered[i].id !== activeId && unread.has(ordered[i].id)) return ordered[i].id;
  }
  return null;
}

export function nextUnreadBox(boxIds: string[], active: string | null, byBox: Record<string, BoxUnread>, dir: 1 | -1): string | null {
  const n = boxIds.length;
  const start = active ? boxIds.indexOf(active) : -1;
  for (let k = 1; k < n + 1; k++) {
    const id = boxIds[(((start + dir * k) % n) + n) % n];
    if (id !== active && (byBox[id]?.white || byBox[id]?.red)) return id;
  }
  return null;
}

const modalOpen = () => !!document.querySelector('[aria-modal="true"]');

interface Args {
  ordered: Session[];
  activeId: string;
  updated: ReadonlySet<string>;
  select: (id: string) => void;
  nav: (r: Route) => void;
}

// Alt+Shift+↑/↓ walks what needs attention, then moves on to the next box that has
// some. Ctrl+digit picks a box, only in the shell: in a browser it switches tabs.
export function useUnreadShortcuts(args: Args): void {
  const { boxes, active, switchBox } = useBoxes();
  const live = useRef({ ...args, boxes, active, switchBox });
  live.current = { ...args, boxes, active, switchBox };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen()) return;
      const L = live.current;
      const ids = sortBoxes(L.boxes).map((b) => b.id);
      if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && /^[1-9]$/.test(e.key) && inDesktopApp()) {
        const id = ids[Number(e.key) - 1];
        if (id) { e.preventDefault(); openBox(id, L.active, L.switchBox); }
        return;
      }
      if (!(e.altKey && e.shiftKey) || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const unread = new Set([...L.updated, ...L.ordered.filter((s) => s.waiting).map((s) => s.id)]);
      const session = nextUnreadSession(L.ordered, L.activeId, unread, dir);
      if (session) { L.select(session); L.nav('/'); return; }
      const box = nextUnreadBox(ids, L.active, boxUnreadStore.get(), dir);
      if (box) openBox(box, L.active, L.switchBox);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
