import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Session } from '../../data/mock';
import { usePersisted } from '../../lib/persist';
import { PINS_KEY, TAGS_KEY, syncEnabled, pushPinsRemote, pushTagsRemote } from '../../lib/session-prefs';
import { filterSessions } from './filter';

interface UseSessionsPanelArgs {
  sessions: Session[];
  searchResults: Session[];
  onSearch?: (q: string) => void;
  userId?: string;
}

export function useSessionsPanel({ sessions, searchResults, onSearch, userId }: UseSessionsPanelArgs) {
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Logado no produto multi-conta: além do cache local, empurra o estado completo
  // pro Supabase pra favoritos/tags seguirem a conta em outro device (a hidratação
  // em [[session-prefs.ts]] traz de volta no login). No loopback fica só local.
  const synced = syncEnabled(userId);
  const [pins, setPins] = usePersisted<string[]>(PINS_KEY, []);
  const pinned = useMemo(() => new Set(pins), [pins]);
  const togglePin = useCallback((id: string) => {
    const next = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id];
    setPins(next);
    if (synced) pushPinsRemote(userId!, next);
  }, [pins, setPins, synced, userId]);

  // Etiquetas por sessão. Permite organizar/filtrar além da recência — o "tags"
  // pedido junto do grupo "trabalhando agora" (#144).
  const [tagMap, setTagMap] = usePersisted<Record<string, string[]>>(TAGS_KEY, {});
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const addTag = useCallback((id: string, tag: string) => {
    const cur = tagMap[id] || [];
    if (cur.includes(tag)) return;
    const next = { ...tagMap, [id]: [...cur, tag] };
    setTagMap(next);
    if (synced) pushTagsRemote(userId!, next);
  }, [tagMap, setTagMap, synced, userId]);
  const removeTag = useCallback((id: string, tag: string) => {
    const cur = (tagMap[id] || []).filter((t) => t !== tag);
    const next = { ...tagMap };
    if (cur.length) next[id] = cur; else delete next[id];
    setTagMap(next);
    if (synced) pushTagsRemote(userId!, next);
  }, [tagMap, setTagMap, synced, userId]);
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const arr of Object.values(tagMap)) for (const t of arr) set.add(t);
    return [...set].sort();
  }, [tagMap]);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘/ foca a busca de sessões (⌘K virou o command palette). Esc limpa+desfoca.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select(); });
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
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
    () => filterSessions(sessions, query, searchResults, pinned, tagFilter, tagMap),
    [sessions, query, searchResults, pinned, tagFilter, tagMap],
  );

  return {
    query, setQuery,
    confirmId, setConfirmId,
    deleteId, setDeleteId,
    pinned, togglePin,
    tagMap, tagFilter, setTagFilter, addTag, removeTag, allTags,
    searchRef,
    filtered,
  };
}
