import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Session } from '../../data/mock';
import { usePersisted } from '../../lib/persist';

interface UseSessionsPanelArgs {
  sessions: Session[];
  searchResults: Session[];
  onSearch?: (q: string) => void;
}

export function useSessionsPanel({ sessions, searchResults, onSearch }: UseSessionsPanelArgs) {
  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pins, setPins] = usePersisted<string[]>('pinned', []);
  const pinned = useMemo(() => new Set(pins), [pins]);
  const togglePin = useCallback((id: string) => {
    setPins((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, [setPins]);

  // Etiquetas por sessão (só FE, via localStorage). Permite organizar/filtrar além
  // da recência — o "tags" pedido junto do grupo "trabalhando agora" (#144).
  const [tagMap, setTagMap] = usePersisted<Record<string, string[]>>('tags', {});
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const addTag = useCallback((id: string, tag: string) => {
    setTagMap((prev) => {
      const cur = prev[id] || [];
      if (cur.includes(tag)) return prev;
      return { ...prev, [id]: [...cur, tag] };
    });
  }, [setTagMap]);
  const removeTag = useCallback((id: string, tag: string) => {
    setTagMap((prev) => {
      const cur = (prev[id] || []).filter((t) => t !== tag);
      const next = { ...prev };
      if (cur.length) next[id] = cur; else delete next[id];
      return next;
    });
  }, [setTagMap]);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = q
      ? (() => {
          const local = sessions.filter(s => (s.title + ' ' + s.snippet).toLowerCase().includes(q));
          const seen = new Set(local.map(s => s.id));
          return [...local, ...searchResults.filter(s => !seen.has(s.id))]; // hits só-por-conteúdo
        })()
      : sessions;
    if (tagFilter) base = base.filter(s => (tagMap[s.id] || []).includes(tagFilter));
    // Fixadas sobem ao topo preservando a ordem original entre si.
    if (pinned.size === 0) return base;
    const top = base.filter(s => pinned.has(s.id));
    const rest = base.filter(s => !pinned.has(s.id));
    return [...top, ...rest];
  }, [sessions, query, searchResults, pinned, tagFilter, tagMap]);

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
