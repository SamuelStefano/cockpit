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
  sessions: Session[];
  running: Set<string>;
  onCanvasGet: () => void;
  onCanvasPos: (pos: Record<string, CanvasPos>) => void;
  onCanvasPosReset: () => void;
  onCanvasCardSave: (card: CanvasCard) => void;
  onCanvasCardDelete: (id: string) => void;
  onLaunchAgent: (prompt: string, title: string) => string;
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
  const pos = useMemo(() => layoutCanvas(visible.nodes, visible.edges, p.board.pos), [visible, p.board.pos]);
  const worldBounds = useMemo(() => bounds(Object.values(pos)), [pos]);
  // First view frames the connected part of the map; the block of sessions with
  // no memory trail is one "fit" away instead of shrinking everything to 8%.
  const coreBounds = useMemo(() => {
    const linked = new Set(visible.edges.flatMap((e) => [e.source, e.target]));
    const core = Object.entries(pos).filter(([id]) => linked.has(id)).map(([, v]) => v);
    return core.length ? bounds(core) : worldBounds;
  }, [visible.edges, pos, worldBounds]);
  const byId = useMemo(() => new Map(merged.nodes.map((n) => [n.id, n])), [merged.nodes]);
  const waiting = useMemo(() => new Set(p.sessions.filter((s) => s.waiting).map((s) => s.id)), [p.sessions]);

  const select = useCallback((id: string, additive: boolean) => {
    setSelected((cur) => (additive ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]));
  }, []);
  const clearSelection = useCallback(() => setSelected([]), []);
  const selectedNodes = useMemo(() => selected.map((id) => byId.get(id)).filter((n): n is CanvasNode => !!n), [selected, byId]);

  const cardOf = useCallback((id: string) => p.board.cards.find((c) => c.id === id), [p.board.cards]);

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
    p.onLaunchAgent(prompt, card.title);
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

  const cardSessions = useCallback((id: string) => boundSessions(merged.edges, id), [merged.edges]);

  return {
    mode, setMode, scope, setScope, archived, setArchived, query, setQuery,
    merged, visible, pos, worldBounds, coreBounds, byId, waiting,
    selected, selectedNodes, select, clearSelection,
    draft, setDraft, newDraft, editCard, saveCard, runCard, setStatus, deleteCard, cardSessions,
  };
}

export type CanvasRoute = ReturnType<typeof useCanvasRoute>;
