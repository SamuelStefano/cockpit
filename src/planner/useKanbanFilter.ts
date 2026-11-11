import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlannerTask } from '../../shared/planner';
import { matchesFilter, tagsOf } from './planner-logic';

const isTyping = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function useKanbanFilter(tasks: PlannerTask[], open: boolean) {
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const allTags = useMemo(() => tagsOf(tasks), [tasks]);
  const activeTags = useMemo(() => tags.filter((t) => allTags.includes(t)), [tags, allTags]);
  const visible = useMemo(
    () => (query.trim() || activeTags.length ? tasks.filter((t) => matchesFilter(t, query, activeTags)) : tasks),
    [tasks, query, activeTags],
  );
  const toggleTag = useCallback((tag: string) => {
    setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));
  }, []);

  return { query, setQuery, allTags, activeTags, toggleTag, visible, searchRef, filtering: visible !== tasks };
}
