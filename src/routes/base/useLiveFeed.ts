import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Message, ToolQuestion } from '../../data/types';
import type { CanvasBoard, CanvasGraph, SessionPeek, TermStats } from '../../../shared/canvas';
import type { Cron, SysStats } from '../../../shared/protocol';
import type { Session } from '../../data/types';
import { adaptLive, emptyPlacement, type LiveAction, type LiveFloor, type Placement } from './liveAdapter';

export interface LiveSource {
  connected: boolean;
  sessions: Session[];
  running: ReadonlySet<string>;
  termStats: Record<string, Partial<TermStats>>;
  threads: Record<string, Message[] | undefined>;
  peeks: Record<string, SessionPeek | null>;
  teamQuestions: { sessionKey: string; questions: ToolQuestion[] }[];
  graph: CanvasGraph | null;
  board: CanvasBoard;
  boardLoaded: boolean;
  stats: SysStats | null;
  crons: Cron[] | null;
  mcpServers: string[] | null;
  onCtxStats: (ids: string[]) => void;
  onPeek: (id: string) => void;
  onLoadThread: (id: string) => void;
  onCanvasGet: () => void;
  onCronsGet: () => void;
  onSendTo: (id: string, text: string) => boolean;
  onStop: (id: string) => void;
  onOpenSession: (id: string) => void;
}

export interface LiveActions { open: (id: string) => void; send: (id: string, text: string) => boolean; stop: (id: string) => void; act: (a: LiveAction) => void }

const POLL_MS = 6000;
const BOARD_POLL_MS = 60000;

function lastText(thread: Message[] | undefined): string | null {
  if (!thread) return null;
  for (let i = thread.length - 1; i >= 0; i--) {
    const m = thread[i];
    if (m.role !== 'assistant') continue;
    for (let k = m.blocks.length - 1; k >= 0; k--) { const b = m.blocks[k]; if (b.type === 'text' && b.text.trim()) return b.text.slice(-600); }
  }
  return null;
}

export function useLiveFeed(s: LiveSource): { live: LiveFloor; actions: LiveActions } {
  const placement = useRef<Placement>(emptyPlacement());
  const [answered, setAnswered] = useState<Record<string, number>>({});
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setTick((n) => n + 1), 30000); return () => window.clearInterval(t); }, []);

  const live = useMemo(() => {
    const tails: Record<string, string | null> = {};
    for (const x of s.sessions) tails[x.id] = lastText(s.threads[x.id]) ?? s.peeks[x.id]?.lastAssistant ?? null;
    const areas: Record<string, string | undefined> = {};
    for (const n of s.graph?.nodes ?? []) if (n.kind === 'session') areas[n.ref] = n.area;
    const r = adaptLive({
      sessions: s.sessions, running: s.running, termStats: s.termStats, threads: s.threads, tails, teamQuestions: s.teamQuestions, areas,
      cards: s.boardLoaded ? s.board.cards : null, stats: s.stats, crons: s.crons, mcpServers: s.mcpServers?.length ?? null, answered, now: Date.now(),
    }, placement.current);
    placement.current = r.placement;
    return r;
    // `tick` ages sessions out of the 24h window even when nothing else changes.
  }, [s.sessions, s.running, s.termStats, s.threads, s.peeks, s.teamQuestions, s.graph, s.board, s.boardLoaded, s.stats, s.crons, s.mcpServers, answered, tick]);

  const shownKey = live.shown.join(','), missingKey = live.missingThreads.join(',');
  const { connected, onCtxStats, onPeek, onLoadThread, onCanvasGet, onCronsGet } = s;

  useEffect(() => {
    if (!connected || !shownKey) return;
    const ids = shownKey.split(',');
    const poll = () => { onCtxStats(ids); for (const id of ids) onPeek(id); };
    poll();
    const t = window.setInterval(poll, POLL_MS);
    return () => window.clearInterval(t);
  }, [connected, shownKey, onCtxStats, onPeek]);

  useEffect(() => {
    if (!connected) return;
    onCanvasGet();
    onCronsGet();
    const t = window.setInterval(onCanvasGet, BOARD_POLL_MS);
    return () => window.clearInterval(t);
  }, [connected, onCanvasGet, onCronsGet]);

  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!connected || !missingKey) return;
    for (const id of missingKey.split(',')) if (!requested.current.has(id)) { requested.current.add(id); onLoadThread(id); }
  }, [connected, missingKey, onLoadThread]);

  const sessionsRef = useRef(s.sessions);
  sessionsRef.current = s.sessions;
  const { onSendTo, onStop, onOpenSession } = s;
  const send = useCallback((id: string, text: string) => onSendTo(id, text), [onSendTo]);
  const act = useCallback((a: LiveAction) => {
    if (a.kind === 'open') { onOpenSession(a.sessionId); return; }
    if (!onSendTo(a.sessionId, a.text)) return;
    const mtime = sessionsRef.current.find((x) => x.id === a.sessionId)?.mtime;
    if (mtime !== undefined) setAnswered((p) => ({ ...p, [a.sessionId]: mtime }));
  }, [onOpenSession, onSendTo]);
  const actions = useMemo<LiveActions>(() => ({ open: onOpenSession, send, stop: onStop, act }), [onOpenSession, send, onStop, act]);
  return { live, actions };
}
