import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CanvasBoard, CanvasCard, CanvasGraph, CanvasNode, CanvasPos, CardStatus, ContentFormat } from '../../../shared/canvas';
import { buildContentPrompt, buildTaskPrompt } from '../../../shared/canvas-prompt';
import type { Session } from '../../data/types';
import { toast } from '../../components/primitives';
import { filterCanvas, type CanvasScope } from './canvas-filter';
import { bounds, layoutCanvas } from './canvas-layout';
import { boundSessions, mergeBoard, moveCard, newCardId } from './canvas-board';

export interface CanvasRouteProps {
  connected: boolean;
  graph: CanvasGraph | null;
  board: CanvasBoard;
  loading: boolean;
  loadingSince: number | null;
  stale: boolean;
  sessions: Session[];
  running: Set<string>;
  onCanvasGet: () => void;
  onCanvasPos: (pos: Record<string, CanvasPos>) => void;
  onCanvasPosReset: () => void;
  onCanvasCardSave: (card: CanvasCard) => void;
  onCanvasCardDelete: (id: string) => void;
  onLaunchAgent: (prompt: string, title: string) => string | null;
  onOpenSession: (id: string) => void;
}

export type CanvasMode = 'split' | 'canvas' | 'kanban';
export interface CardDraft { card: CanvasCard; isNew: boolean }

const REFRESH_DEBOUNCE_MS = 2500;
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export function useCanvasRoute(p: CanvasRouteProps) {
  const [mode, setMode] = useState<CanvasMode>('split');
  const [scope, setScope] = useState<CanvasScope>('active');
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [now] = useState(() => Date.now());

  const { onCanvasGet } = p;
  useEffect(() => { if (p.connected) onCanvasGet(); }, [p.connected, onCanvasGet]);

  // New sessions and fresh memory writes only show up after a rebuild; the
  // sessions broadcast is the cheapest signal that something moved.
  const sessionsSig = p.sessions.length ? `${p.sessions.length}:${p.sessions[0].id}:${p.sessions[0].mtime}` : '';
  const firstSig = useRef(sessionsSig);
  useEffect(() => {
    if (!p.connected || sessionsSig === firstSig.current) return;
    const t = setTimeout(onCanvasGet, REFRESH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [sessionsSig, p.connected, onCanvasGet]);

  const merged = useMemo(() => mergeBoard(p.graph, p.board.cards), [p.graph, p.board.cards]);
  const visible = useMemo(
    () => filterCanvas(merged.nodes, merged.edges, { scope, archived, query, running: p.running, cards: p.board.cards, now }),
    [merged, scope, archived, query, p.running, p.board.cards, now],
  );
  // Positions come from the scope WITHOUT the search query: typing only hides
  // nodes, it never re-packs the map under the user's eyes.
  const layoutBase = useMemo(
    () => (query ? filterCanvas(merged.nodes, merged.edges, { scope, archived, query: '', running: p.running, cards: p.board.cards, now }) : visible),
    [query, merged, scope, archived, p.running, p.board.cards, now, visible],
  );
  const pos = useMemo(() => layoutCanvas(layoutBase.nodes, layoutBase.edges, p.board.pos), [layoutBase, p.board.pos]);
  const worldBounds = useMemo(() => bounds(visible.nodes.map((n) => pos[n.id]).filter(Boolean)), [visible.nodes, pos]);
  const RECENT_FOCUS_N = 8;
  // First view frames what is alive right now (running sessions + whatever
  // they touch), falling back to the handful of most recent sessions when
  // nothing is running. The rest of the map is one "fit all" away instead of
  // shrinking everything to ~8% to fit the whole history on screen.
  const coreBounds = useMemo(() => {
    const sessionNodes = visible.nodes.filter((n) => n.kind === 'session');
    let anchors = sessionNodes.filter((n) => p.running.has(n.ref));
    if (!anchors.length) anchors = [...sessionNodes].sort((a, b) => b.mtime - a.mtime).slice(0, RECENT_FOCUS_N);
    const focus = new Set(anchors.map((n) => n.id));
    for (const e of visible.edges) {
      if (focus.has(e.source)) focus.add(e.target);
      if (focus.has(e.target)) focus.add(e.source);
    }
    const core = Object.entries(pos).filter(([id]) => focus.has(id)).map(([, v]) => v);
    return core.length ? bounds(core) : worldBounds;
  }, [visible.nodes, visible.edges, pos, worldBounds, p.running]);
  const byId = useMemo(() => new Map(merged.nodes.map((n) => [n.id, n])), [merged.nodes]);
  const waiting = useMemo(() => new Set(p.sessions.filter((s) => s.waiting).map((s) => s.id)), [p.sessions]);

  const select = useCallback((id: string, additive: boolean) => {
    setSelected((cur) => (additive ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]));
  }, []);
  const clearSelection = useCallback(() => setSelected([]), []);
  const selectedNodes = useMemo(() => selected.map((id) => byId.get(id)).filter((n): n is CanvasNode => !!n), [selected, byId]);

  const cardOf = useCallback((id: string) => p.board.cards.find((c) => c.id === id), [p.board.cards]);

  // A card-launched agent lives under its local `new-xxx` key for its whole
  // first turn — the server graph only knows real transcript-backed session
  // ids, so the card→session edge (and cardRun/"rodando") wouldn't show up
  // until well after the turn ends. Bind the launched key to the card on the
  // client and let it ride `p.running` directly; drop it once the turn is
  // over (running no longer has it) past a short grace window that covers
  // the round-trip before the server's own `started` frame arrives.
  const pendingLaunch = useRef<Record<string, { key: string; addedAt: number }>>({});
  const [pendingTick, setPendingTick] = useState(0);
  const PENDING_LAUNCH_GRACE_MS = 4000;
  useEffect(() => {
    const rec = pendingLaunch.current;
    let changed = false;
    const now = Date.now();
    for (const [cardId, { key, addedAt }] of Object.entries(rec)) {
      if (p.running.has(key)) continue;
      if (now - addedAt < PENDING_LAUNCH_GRACE_MS) continue;
      delete rec[cardId];
      changed = true;
    }
    if (changed) setPendingTick((t) => t + 1);
  }, [p.running]);

  const newDraft = useCallback((kind: CanvasCard['kind'], from: CanvasNode[]) => {
    const t = Date.now();
    const contexts = from.filter((n) => n.kind === 'context').map((n) => n.ref);
    const sessions = from.filter((n) => n.kind === 'session').map((n) => n.ref);
    const title = from.length === 1 ? from[0].title : '';
    setDraft({
      isNew: true,
      card: {
        id: newCardId(t, Math.random()), title, prompt: '', status: 'todo', kind,
        format: kind === 'content' ? 'post' : undefined, contextIds: contexts, sessionIds: sessions, createdAt: t, updatedAt: t,
      },
    });
  }, []);

  const editCard = useCallback((id: string) => {
    const c = cardOf(id);
    if (c) setDraft({ card: c, isNew: false });
  }, [cardOf]);

  const saveCard = useCallback((card: CanvasCard) => {
    p.onCanvasCardSave({ ...card, updatedAt: Date.now() });
    setDraft(null);
  }, [p]);

  const runCard = useCallback((card: CanvasCard) => {
    const contexts = card.contextIds.map((id) => byId.get(`c:${id}`)).filter((n): n is CanvasNode => !!n);
    const sessions = card.sessionIds.map((id) => byId.get(`s:${id}`)).filter((n): n is CanvasNode => !!n);
    const prompt = card.kind === 'content'
      ? buildContentPrompt(card, (card.format ?? 'post') as ContentFormat, contexts, sessions, today())
      : buildTaskPrompt(card, contexts, sessions);
    const launchedKey = p.onLaunchAgent(prompt, card.title);
    // WS fechado: onLaunchAgent já avisou na sessão nova. O card não pode
    // pular pra "fazendo" nem anunciar um disparo que não saiu.
    if (!launchedKey) {
      toast('Não deu pra disparar o agente: sem conexão com o servidor.', { tone: 'error', durationMs: 5000 });
      return;
    }
    pendingLaunch.current[card.id] = { key: launchedKey, addedAt: Date.now() };
    setPendingTick((t) => t + 1);
    p.onCanvasCardSave(moveCard(card, 'doing', Date.now()));
    setDraft(null);
    toast(`Agente disparado: ${card.title}`, { durationMs: 5000 });
  }, [byId, p]);

  const setStatus = useCallback((id: string, status: CardStatus) => {
    const c = cardOf(id);
    if (c && c.status !== status) p.onCanvasCardSave(moveCard(c, status, Date.now()));
  }, [cardOf, p]);

  const deleteCard = useCallback((id: string) => {
    p.onCanvasCardDelete(id);
    setSelected((cur) => cur.filter((x) => x !== `k:${id}`));
    setDraft(null);
  }, [p]);

  const cardSessions = useCallback((id: string) => {
    const real = boundSessions(merged.edges, id);
    const pending = pendingLaunch.current[id];
    return pending && !real.includes(pending.key) ? [...real, pending.key] : real;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pendingTick forces a
    // fresh callback identity when the pending map mutates; its value isn't read.
  }, [merged.edges, pendingTick]);

  return {
    mode, setMode, scope, setScope, archived, setArchived, query, setQuery,
    merged, visible, pos, worldBounds, coreBounds, byId, waiting,
    selected, selectedNodes, select, clearSelection,
    draft, setDraft, newDraft, editCard, saveCard, runCard, setStatus, deleteCard, cardSessions,
  };
}

export type CanvasRoute = ReturnType<typeof useCanvasRoute>;
