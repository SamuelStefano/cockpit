import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { usePersisted } from '../lib/persist';
import type { Session } from '../data/mock';
import type { Route } from '../useRoute';

interface Args {
  sessions: Session[];
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  updated: Set<string>;
  nav: (r: Route) => void;
  setPalette: Dispatch<SetStateAction<boolean>>;
  setHelp: Dispatch<SetStateAction<boolean>>;
}

const isTyping = () => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

export function useGlobalShortcuts({ sessions, activeSessionId, setActiveSessionId, updated, nav, setPalette, setHelp }: Args) {
  const [navPins] = usePersisted<string[]>('pinned', []); // espelha a ordem do sidebar p/ Alt+↑/↓

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        if (!isTyping()) { e.preventDefault(); setHelp((h) => !h); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette, setHelp]);

  // Alt+↑/↓ cicla entre sessões (ergonomia do run noturno multi-sessão). Usa a
  // mesma ordem do sidebar (fixadas no topo). Funciona mesmo com o input em foco
  // — Alt+seta não é combo de edição de texto comum.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const pinSet = new Set(navPins);
      const ordered = [...sessions.filter((s) => pinSet.has(s.id)), ...sessions.filter((s) => !pinSet.has(s.id))];
      if (ordered.length < 2) return;
      e.preventDefault();
      const i = ordered.findIndex((s) => s.id === activeSessionId);
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = ordered[(((i < 0 ? 0 : i) + delta) % ordered.length + ordered.length) % ordered.length];
      if (next) setActiveSessionId(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sessions, activeSessionId, navPins, setActiveSessionId]);

  // `n` salta pra próxima sessão com output novo não visto (ergonomia do run
  // noturno: vários turnos terminam em background; `n` cicla só pelas que
  // produziram algo). `n` é tecla de digitação — só age fora de input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping()) return;
      if (!updated.size) return;
      const pinSet = new Set(navPins);
      const ordered = [...sessions.filter((s) => pinSet.has(s.id)), ...sessions.filter((s) => !pinSet.has(s.id))];
      if (!ordered.length) return;
      e.preventDefault();
      const start = ordered.findIndex((s) => s.id === activeSessionId);
      for (let k = 1; k <= ordered.length; k++) {
        const cand = ordered[((start < 0 ? -1 : start) + k) % ordered.length];
        if (cand && updated.has(cand.id)) { setActiveSessionId(cand.id); nav('/'); break; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sessions, activeSessionId, navPins, updated, setActiveSessionId, nav]);
}
