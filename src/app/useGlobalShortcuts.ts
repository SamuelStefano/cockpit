import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { usePersisted } from '../lib/persist';
import { isApple } from '../lib/platform';
import { WAITING_DISMISSED_KEY } from '../lib/prefs';
import { useSidebarCollapsed } from '../components/chrome/sidebar/useSidebarCollapsed';
import { requestTerminal, requestTerminalToggle } from '../lib/terminal-request';
import { sidebarOrder } from './sidebar-order';
import type { Session } from '../data/types';
import type { Route } from '../useRoute';

interface Args {
  // Sessions as the sidebar lists them (bot threads already removed).
  sessions: Session[];
  running: Set<string>;
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  updated: Set<string>;
  nav: (r: Route) => void;
  onNew: () => void;
  setPalette: Dispatch<SetStateAction<boolean>>;
  setHelp: Dispatch<SetStateAction<boolean>>;
}

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

// Session switching behind an open dialog swapped the chat under a confirm or
// an editor that still pointed at the previous session.
const modalOpen = () => !!document.querySelector('[aria-modal="true"]');

export function useGlobalShortcuts({ sessions, running, activeSessionId, setActiveSessionId, updated, nav, onNew, setPalette, setHelp }: Args) {
  const [navPins] = usePersisted<string[]>('pinned', []);
  const [dismissedMap] = usePersisted<Record<string, number>>(WAITING_DISMISSED_KEY, {});
  const { toggle: toggleSidebar } = useSidebarCollapsed();
  const ordered = useMemo(
    () => sidebarOrder(sessions, { pinned: new Set(navPins), running, dismissed: new Set(Object.keys(dismissedMap)) }),
    [sessions, navPins, running, dismissedMap],
  );
  // One ref for everything the key handlers read, so the listeners bind once.
  const live = useRef({ ordered, activeSessionId, updated, onNew, toggleSidebar, setActiveSessionId, nav });
  live.current = { ordered, activeSessionId, updated, onNew, toggleSidebar, setActiveSessionId, nav };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const L = live.current;
      if (mod && !e.altKey && k === 'k' && !e.shiftKey) {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (e.key === '?' && !mod) {
        if (!isTyping()) { e.preventDefault(); setHelp((h) => !h); }
        return;
      }
      if (modalOpen()) return;
      // App shortcuts: ⌘ on Apple keyboards, Alt elsewhere (Ctrl+letter belongs to the browser and the terminal).
      const appMod = isApple() ? e.metaKey && !e.ctrlKey : e.altKey && !e.ctrlKey && !e.metaKey;
      if (appMod) {
        if ((e.target as Element | null)?.closest?.('.xterm')) return;
        if (e.shiftKey && k === 'o') { e.preventDefault(); L.onNew(); return; }
        if (e.shiftKey && k === 'k') { e.preventDefault(); L.nav('/canvas'); return; }
        if (!e.shiftKey && k === 'b' && !isTyping()) { e.preventDefault(); L.toggleSidebar(); return; }
        if (!e.shiftKey && k === 'j' && !isTyping()) {
          e.preventDefault();
          if (location.pathname === '/' || location.pathname.startsWith('/c/')) requestTerminalToggle();
          else { requestTerminal(); L.nav('/'); }
          return;
        }
        if (!e.shiftKey && /^[1-9]$/.test(e.key)) {
          const target = L.ordered[Number(e.key) - 1];
          if (target) { e.preventDefault(); L.setActiveSessionId(target.id); L.nav('/'); }
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette, setHelp]);

  // Alt+↑/↓ cycles sessions in the sidebar's order. Works with the composer
  // focused (Alt+arrow is not a text-editing combo) and always lands on the chat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (modalOpen()) return;
      const { ordered: list, activeSessionId: active, setActiveSessionId: select, nav: go } = live.current;
      if (list.length < 2) return;
      e.preventDefault();
      const i = list.findIndex((s) => s.id === active);
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = list[(((i < 0 ? 0 : i) + delta) % list.length + list.length) % list.length];
      if (next) { select(next.id); go('/'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // `n` jumps to the next session with unseen output (overnight runs finish in
  // the background). It is a typing key, so it only acts outside inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping() || modalOpen()) return;
      const { ordered: list, activeSessionId: active, updated: unseen, setActiveSessionId: select, nav: go } = live.current;
      if (!unseen.size || !list.length) return;
      e.preventDefault();
      const start = list.findIndex((s) => s.id === active);
      for (let k = 1; k <= list.length; k++) {
        const cand = list[((start < 0 ? -1 : start) + k) % list.length];
        if (cand && unseen.has(cand.id)) { select(cand.id); go('/'); break; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
