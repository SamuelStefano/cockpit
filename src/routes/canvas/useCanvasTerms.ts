import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sessionNodeId, shellNodeId, type CanvasNode } from '../../../shared/canvas';
import type { TermApi } from '../../useCockpit';
import { usePersisted } from '../../lib/persist';
import { capOpen, newShellId, shellNodes, watchTermId } from './canvas-terms';

const LIST_EVERY_MS = 20_000;
// ctrl-c flushes the tty input queue (ISIG), so the resume command has to wait
// for the transcript follower to die and bash to come up before it is typed.
const RESUME_DELAY_MS = 700;
const SESSION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface TermTarget { termId: string; watch?: string }

export function termTarget(n: CanvasNode): TermTarget | null {
  if (n.kind === 'shell') return { termId: n.ref };
  if (n.kind === 'session' && SESSION_UUID_RE.test(n.ref)) return { termId: watchTermId(n.ref), watch: n.ref };
  return null;
}

export function useCanvasTerms(term: TermApi, discovered: string[], listTerms: () => void) {
  const [open, setOpen] = usePersisted<string[]>('canvas.openTerms', []);
  const [created, setCreated] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [focusN, setFocusN] = useState(0);
  const [maximized, setMaximized] = useState<string | null>(null);
  // Closed by hand in this page's lifetime: a running session must not pop its
  // terminal back open on the next streamed token after the user dismissed it.
  const dismissed = useRef(new Set<string>());

  useEffect(() => {
    listTerms();
    const t = setInterval(listTerms, LIST_EVERY_MS);
    return () => clearInterval(t);
  }, [listTerms]);

  const [now] = useState(() => Date.now());
  const shells = useMemo(() => shellNodes([...new Set([...discovered, ...created])], now), [discovered, created, now]);
  const shellIds = useMemo(() => new Set(shells.map((s) => s.id)), [shells]);

  // Shell nodes are always windows; sessions only while opened.
  const windows = useMemo(() => [...open.filter((id) => !id.startsWith('t:')), ...shellIds], [open, shellIds]);

  const openWindow = useCallback((id: string) => {
    dismissed.current.delete(id);
    setOpen((cur) => capOpen(cur, id));
  }, [setOpen]);

  const focus = useCallback((id: string) => {
    setActive(id);
    setFocusN((n) => n + 1);
  }, []);

  const collapse = useCallback((id: string) => {
    dismissed.current.add(id);
    setOpen((cur) => cur.filter((x) => x !== id));
    setActive((a) => (a === id ? null : a));
    setMaximized((m) => (m === id ? null : m));
  }, [setOpen]);

  const kill = useCallback((n: CanvasNode) => {
    const t = termTarget(n);
    if (!t) return;
    term.kill(t.termId);
    if (n.kind === 'shell') setCreated((cur) => cur.filter((x) => x !== t.termId));
    collapse(n.id);
    setTimeout(listTerms, 500);
  }, [term, collapse, listTerms]);

  const newShell = useCallback(() => {
    const id = newShellId(Math.random());
    setCreated((cur) => [...cur, id]);
    focus(shellNodeId(id));
    setTimeout(listTerms, 1500);
  }, [focus, listTerms]);

  const resume = useCallback((sessionId: string) => {
    const id = watchTermId(sessionId);
    term.input(id, '\x03');
    setTimeout(() => term.input(id, `claude --resume ${sessionId}\r`), RESUME_DELAY_MS);
    focus(sessionNodeId(sessionId));
  }, [term, focus]);

  const blur = useCallback(() => setActive(null), []);

  const openMany = useCallback((ids: string[]) => {
    for (const id of ids) dismissed.current.delete(id);
    setOpen((cur) => ids.reduce((acc, id) => capOpen(acc, id), cur));
  }, [setOpen]);

  const autoOpen = useCallback((ids: string[]) => {
    const fresh = ids.filter((id) => !dismissed.current.has(id) && !open.includes(id));
    if (fresh.length) setOpen((cur) => fresh.reduce((acc, id) => capOpen(acc, id), cur));
  }, [open, setOpen]);

  return {
    open: windows, shells, active, focusN, maximized,
    openWindow, openMany, collapse, kill, newShell, resume, autoOpen, focus,
    blur, setMaximized,
  };
}

export type CanvasTerms = ReturnType<typeof useCanvasTerms>;
