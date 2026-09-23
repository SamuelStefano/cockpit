import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sessionNodeId, shellNodeId, type CanvasNode } from '../../../shared/canvas';
import type { TermApi } from '../../useCockpit';
import { usePersisted } from '../../lib/persist';
import { autoAdd, capOpen, newShellId, shellNodes, watchTermId } from './canvas-terms';

const LIST_EVERY_MS = 20_000;
const RESUME_LOCK_MS = 4000;
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
  const openRef = useRef(open);
  openRef.current = open;
  const [resuming, setResuming] = useState<string | null>(null);
  // Session ids whose pane is (or was last put into) an interactive
  // `claude --resume`, outside Deck's own run tracking. See `resume` below.
  const [resumedLive, setResumedLive] = useState<Set<string>>(new Set());

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
    // Closing the window is the only client-side signal we have that the pane
    // "went back" from a resumed interactive claude (server ack for that would
    // need deeper pty tracking) — clear the double-writer guard so reopening
    // later doesn't leave the prompt bar disabled forever.
    if (id.startsWith('s:')) {
      const sid = id.slice(2);
      setResumedLive((cur) => { if (!cur.has(sid)) return cur; const next = new Set(cur); next.delete(sid); return next; });
    }
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

  // The server types the command only if the pane is still just following the
  // transcript — a pane where claude already runs must not get ctrl-c + text.
  const resume = useCallback((sessionId: string) => {
    term.resume(watchTermId(sessionId), sessionId);
    setResuming(sessionId);
    // Sticks past RESUME_LOCK_MS (unlike `resuming`, a short "button is
    // mid-click" latch): the pane now runs an INTERACTIVE `claude --resume`
    // outside Deck's `threads` map entirely, so the canvas prompt bar (feature
    // 4) must stay disabled — sending through it would start a SECOND writer
    // on the same transcript (canvas review #593 item 1). Cleared on collapse.
    setResumedLive((cur) => (cur.has(sessionId) ? cur : new Set(cur).add(sessionId)));
    setTimeout(() => setResuming((r) => (r === sessionId ? null : r)), RESUME_LOCK_MS);
    focus(sessionNodeId(sessionId));
  }, [term, focus]);

  const blur = useCallback(() => setActive(null), []);

  const openMany = useCallback((ids: string[]) => {
    for (const id of ids) dismissed.current.delete(id);
    setOpen((cur) => ids.reduce((acc, id) => capOpen(acc, id), cur));
  }, [setOpen]);

  const autoOpen = useCallback((ids: string[]) => {
    const running = ids.filter((id) => !dismissed.current.has(id));
    if (autoAdd(openRef.current, running) !== openRef.current) setOpen((cur) => autoAdd(cur, running));
  }, [setOpen]);

  return {
    open: windows, shells, active, focusN, maximized, resuming, resumedLive,
    openWindow, openMany, collapse, kill, newShell, resume, autoOpen, focus,
    blur, setMaximized,
  };
}

export type CanvasTerms = ReturnType<typeof useCanvasTerms>;
