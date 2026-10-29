import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Session } from '../../data/types';
import { usePersisted } from '../../lib/persist';
import { PINS_KEY, syncEnabled, pushPinsRemote } from '../../lib/session-prefs';
import { filterSessions } from './filter';
import { useWaitingDismissed } from './useWaitingDismissed';

interface UseSessionsPanelArgs {
  sessions: Session[];
  archived?: Session[];
  searchResults: Session[];
  onSearch?: (q: string) => void;
  userId?: string;
}

export function useSessionsPanel({ sessions, archived = [], searchResults, onSearch, userId }: UseSessionsPanelArgs) {
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Sessão sumiu (deletada/arquivada por outro cliente) com o modal aberto:
  // fecha em vez de deixar um confirm órfão agindo num id que não existe mais.
  useEffect(() => {
    if (confirmId && !sessions.some((s) => s.id === confirmId)) setConfirmId(null);
  }, [confirmId, sessions]);
  useEffect(() => {
    if (deleteId && !sessions.some((s) => s.id === deleteId) && !archived.some((s) => s.id === deleteId)) setDeleteId(null);
  }, [deleteId, sessions, archived]);
  // Logado no produto multi-conta: além do cache local, empurra o estado completo
  // pro Supabase pra favoritos seguirem a conta em outro device (a hidratação
  // em [[session-prefs.ts]] traz de volta no login). No loopback fica só local.
  const synced = syncEnabled(userId);
  const [pins, setPins] = usePersisted<string[]>(PINS_KEY, []);
  const pinned = useMemo(() => new Set(pins), [pins]);
  const togglePin = useCallback((id: string) => {
    const next = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id];
    setPins(next);
    if (synced) pushPinsRemote(userId!, next);
  }, [pins, setPins, synced, userId]);

  const { dismissed: dismissedWaiting, dismissWaiting } = useWaitingDismissed(sessions);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘/ foca a busca de sessões (⌘K virou o command palette). Esc limpa+desfoca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select(); });
      } else if (e.key === 'Escape' && !e.defaultPrevented && !e.isComposing && document.activeElement === searchRef.current) {
        // Consome o Esc: limpar a busca não deve fechar overlays no mesmo keypress.
        e.preventDefault();
        setQuery('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Busca de conteúdo no backend (debounce 150ms). O filtro local (título/snippet)
  // aparece na hora; os hits por CONTEÚDO chegam logo depois e são mesclados.
  useEffect(() => {
    if (!onSearch) return;
    const id = setTimeout(() => onSearch(query), 150);
    return () => clearTimeout(id);
  }, [query, onSearch]);

  const filtered = useMemo(
    () => filterSessions(sessions, query, searchResults, pinned),
    [sessions, query, searchResults, pinned],
  );

  return {
    query, setQuery,
    confirmId, setConfirmId,
    deleteId, setDeleteId,
    pinned, togglePin,
    dismissedWaiting, dismissWaiting,
    searchRef,
    filtered,
  };
}
