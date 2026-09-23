import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AreaBudget, AreaId, CanvasBoard, CanvasCard, CanvasFlow, CanvasGraph, CanvasNode, CanvasPos, CardStatus, ContentFormat, TermStats,
} from '../../../shared/canvas';
import { AREA_IDS } from '../../../shared/canvas';
import { buildContentPrompt, buildContinuePrompt, buildTaskPrompt } from '../../../shared/canvas-prompt';
import { evaluateBudget, type AreaUsage, type BudgetStatus } from '../../../shared/canvas-budget';
import type { Session } from '../../data/types';
import type { TermApi } from '../../useCockpit';
import { toast } from '../../components/primitives';
import { usePersisted } from '../../lib/persist';
import { computeAreaRects } from './canvas-areas';
import { filterCanvas, type CanvasScope } from './canvas-filter';
import { bounds, layoutCanvas } from './canvas-layout';
import { boundSessions, mergeBoard, moveCard, newCardId, resolveSaveStatus, stuckContinueCard } from './canvas-board';
import { deriveSessionItems, doneRecentSessionIds, type LiveSessionInfo, type SessionKanbanItem } from './kanban-items';
import { placeWindows, TERM_H, TERM_W, winKey } from './canvas-terms';

export interface CanvasRouteProps {
  connected: boolean;
  graph: CanvasGraph | null;
  board: CanvasBoard;
  loading: boolean;
  loadingSince: number | null;
  stale: boolean;
  sessions: Session[];
  running: Set<string>;
  runStart: Record<string, number>; // sessionKey -> live turn start ms, for the timeline's "running spans T"
  onCanvasGet: () => void;
  onCanvasPos: (pos: Record<string, CanvasPos>) => void;
  onCanvasPosReset: () => void;
  onCanvasCardSave: (card: CanvasCard) => void;
  onCanvasCardDelete: (id: string) => void;
  onCanvasSessionStatus: (sessionId: string, status: CardStatus) => void;
  onCanvasFlowSave: (flow: CanvasFlow) => void;
  onCanvasFlowDelete: (id: string) => void;
  canvasFlowFired: Record<string, number>;
  // cardId -> the `new-<uuid>` run key a server-side flow just started for
  // that card. Absorbed into the same pendingLaunch map runCard uses, so
  // cardRun() shows "rodando" and the kanban can stop it exactly like a
  // client-launched run.
  canvasFlowRuns: Record<string, { key: string; at: number }>;
  onCanvasBudgetSave: (area: AreaId, budget: AreaBudget) => void;
  onLaunchAgent: (prompt: string, title: string) => string | null;
  onOpenSession: (id: string) => void;
  onSendTo: (sessionId: string, text: string) => boolean;
  canvasSendError: { sessionId: string; text: string; message: string; at: number } | null;
  dismissCanvasSendError: () => void;
  // Card "fork" (session-reuse.ts): dispara um chat paralelo que herda o
  // transcript inteiro da sessão-mãe sem tocar seu turno. O forkId real volta
  // via canvasForkRuns (cardId -> {key, at}), absorvido em pendingLaunch
  // exatamente como canvasFlowRuns já faz pra um run de fluxo.
  onLaunchFork: (parentSessionId: string, cardId: string, text: string) => boolean;
  canvasForkRuns: Record<string, { key: string; at: number }>;
  term: TermApi;
  termStats: Record<string, TermStats>;
  onTermStats: (sessions: string[], terms: string[]) => void;
  // CardEditor's reuse-pool lookup (session-reuse.ts) — a SEPARATE, lighter
  // request than onTermStats: see shared/protocol.ts's 'canvas-ctx-stats'
  // comment for why it must never share onTermStats' wire message.
  onCanvasCtxStats: (sessions: string[]) => void;
  areaUsage: Partial<Record<AreaId, AreaUsage>>;
  discoveredTerms: string[];
  listTerms: () => void;
  // sessionKey -> endReason for a RECOVERABLE cut (budget/max_turns) THIS
  // client just watched happen (src/useCockpit.ts `interrupted`) — a faster,
  // client-only supplement to the server-persisted lastTurnOk on p.sessions.
  interrupted: Record<string, string>;
}

export type CanvasMode = 'canvas' | 'kanban';
export interface CardDraft { card: CanvasCard; isNew: boolean }

const REFRESH_DEBOUNCE_MS = 2500;
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export function useCanvasRoute(p: CanvasRouteProps, windowIds: string[], shells: CanvasNode[]) {
  const [mode, setMode] = useState<CanvasMode>('canvas');
  // Default is the execution panel (TL feedback, 2026-09-23: "who is working,
  // who stopped, who finished", not the whole second-brain graph) — persisted
  // per device so whatever the user last picked sticks across reloads.
  const [scope, setScope] = usePersisted<CanvasScope>('canvas.scope', 'exec');
  const [showAutomation, setShowAutomation] = usePersisted('canvas.showAutomation', false);
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = usePersisted<AreaId | null>('canvas.areaFilter', null);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<CardDraft | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // The Done-≤24h window (kanban-items.ts doneRecentSessionIds) and the
  // active-scope 48h window both compare against `now` — without a tick, a
  // tab left open past either boundary would keep framing a session as
  // fresh/recent forever. A minute is plenty for a 24h/48h window.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

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
  // Same signal also re-clocks `now` at once — a burst of session activity
  // shouldn't have to wait up to a minute for the Done window to catch up.
  useEffect(() => { setNow(Date.now()); }, [sessionsSig]);

  const merged = useMemo(() => mergeBoard(p.graph, p.board.cards), [p.graph, p.board.cards]);
  // Raw open-terminal-window ids (NOT useCanvasRoute's own scope-filtered
  // `windows` below — that would be circular, it's derived FROM `visible`).
  const windowIdSet = useMemo(() => new Set(windowIds), [windowIds]);
  const turnStartedAt = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, s] of Object.entries(p.termStats)) if (s.turnStartedAt !== undefined) out[id] = s.turnStartedAt;
    return out;
  }, [p.termStats]);
  // The freshest waiting/mtime/lastTurnOk per session — src/data/types.ts
  // Session (p.sessions), NOT the CanvasNode graph, which can lag a whole
  // rebuild behind (canvas review — exec-scope adversarial pass #1).
  const liveSessions = useMemo(() => {
    const m = new Map<string, LiveSessionInfo>();
    for (const s of p.sessions) m.set(s.id, { waiting: s.waiting, mtime: s.mtime, lastTurnOk: s.lastTurnOk });
    return m;
  }, [p.sessions]);
  const nodeStatusOpts = { running: p.running, overrides: p.board.sessionStatus, turnStartedAt, liveSessions, interrupted: p.interrupted };
  // Every SESSION NODE, not deriveSessionItems' deduped/automation-filtered
  // list: a session bound to a card, or an automation run, still counts as
  // "just finished" for the execution scope's own framing.
  const doneRecentIds = useMemo(
    () => doneRecentSessionIds(merged.nodes, nodeStatusOpts, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nodeStatusOpts is a
    // fresh object every render; its own members are the real deps.
    [merged.nodes, p.running, p.board.sessionStatus, turnStartedAt, liveSessions, p.interrupted, now],
  );
  const filterExtras = { windowIds: windowIdSet, doneRecentIds, showAutomation, liveSessions };
  const visible = useMemo(() => {
    const v = filterCanvas(merged.nodes, merged.edges, { scope, archived, query, area: areaFilter, running: p.running, cards: p.board.cards, now, ...filterExtras });
    const q = query.trim().toLowerCase();
    // Shells carry no area (they're not tied to any session's memory trail): an
    // active area filter hides them along with everything else unclassified,
    // same as the card nodes filterCanvas already drops in that case.
    return { ...v, nodes: [...v.nodes, ...(areaFilter ? [] : shells.filter((s) => !q || s.title.toLowerCase().includes(q)))] };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterExtras is a fresh
    // object every render; its own members (windowIdSet/doneRecentIds/showAutomation) are the real deps.
  }, [merged, scope, archived, query, areaFilter, p.running, p.board.cards, now, shells, windowIdSet, doneRecentIds, showAutomation]);
  // Positions come from the scope WITHOUT the search query or the area filter:
  // typing or picking an area only hides nodes, it never re-packs the map
  // under the user's eyes — a dragged/settled layout must survive toggling it.
  const layoutBase = useMemo(
    () => (query || areaFilter
      ? filterCanvas(merged.nodes, merged.edges, { scope, archived, query: '', area: null, running: p.running, cards: p.board.cards, now, ...filterExtras })
      : visible),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same as visible above.
    [query, areaFilter, merged, scope, archived, p.running, p.board.cards, now, visible, windowIdSet, doneRecentIds, showAutomation],
  );
  const visibleIds = useMemo(() => new Set(visible.nodes.map((n) => n.id)), [visible.nodes]);
  const windows = useMemo(() => new Set(windowIds.filter((id) => visibleIds.has(id))), [windowIds, visibleIds]);
  const pos = useMemo(
    () => placeWindows(layoutCanvas(layoutBase.nodes, layoutBase.edges, p.board.pos), p.board.pos, [...windows]),
    [layoutBase, p.board.pos, windows],
  );
  const rectOf = useCallback((id: string) => {
    const at = pos[id];
    return at && (windows.has(id) ? { ...at, w: TERM_W, h: TERM_H } : at);
  }, [pos, windows]);
  const worldBounds = useMemo(() => bounds(visible.nodes.map((n) => rectOf(n.id)).filter(Boolean)), [visible.nodes, rectOf]);

  // A lane slot is only a guess until saved: closing a neighbour would slide
  // this window over. Pin it on first placement so it stays put from then on.
  const pinned = useRef(new Set<string>());
  const { onCanvasPos } = p;
  useEffect(() => { if (!Object.keys(p.board.pos).length) pinned.current.clear(); }, [p.board.pos]);
  // Gated on the graph: it arrives after canvas-board, so by then the saved
  // positions are known and a default slot never overwrites a dragged window.
  const boardReady = !!p.graph;
  useEffect(() => {
    if (!boardReady) return;
    const fresh = [...windows].filter((id) => !p.board.pos[winKey(id)] && pos[id] && !pinned.current.has(id));
    if (!fresh.length) return;
    for (const id of fresh) pinned.current.add(id);
    onCanvasPos(Object.fromEntries(fresh.map((id) => [winKey(id), pos[id]])));
  }, [boardReady, windows, pos, p.board.pos, onCanvasPos]);

  // A dragged window saves under its window key, leaving the session's card
  // where it orbits its contexts.
  const onDrop = useCallback((moved: Record<string, CanvasPos>) => {
    onCanvasPos(Object.fromEntries(Object.entries(moved).map(([id, at]) => [windows.has(id) ? winKey(id) : id, at])));
  }, [windows, onCanvasPos]);
  const RECENT_FOCUS_N = 8;
  // First view frames what is alive right now (running sessions + whatever
  // they touch), falling back to the handful of most recent sessions when
  // nothing is running. The rest of the map is one "fit all" away instead of
  // shrinking everything to ~8% to fit the whole history on screen.
  const coreBounds = useMemo(() => {
    // Open terminals are the live picture of the Deck: frame them first.
    if (windows.size) return bounds([...windows].map(rectOf).filter(Boolean));
    const sessionNodes = visible.nodes.filter((n) => n.kind === 'session');
    let anchors = sessionNodes.filter((n) => p.running.has(n.ref));
    if (!anchors.length) anchors = [...sessionNodes].sort((a, b) => b.mtime - a.mtime).slice(0, RECENT_FOCUS_N);
    const focus = new Set(anchors.map((n) => n.id));
    for (const e of visible.edges) {
      if (focus.has(e.source)) focus.add(e.target);
      if (focus.has(e.target)) focus.add(e.source);
    }
    const core = [...focus].map(rectOf).filter(Boolean);
    return core.length ? bounds(core) : worldBounds;
  }, [visible.nodes, visible.edges, worldBounds, p.running, windows, rectOf]);
  const byId = useMemo(() => new Map([...merged.nodes, ...shells].map((n) => [n.id, n])), [merged.nodes, shells]);
  const waiting = useMemo(() => new Set(p.sessions.filter((s) => s.waiting).map((s) => s.id)), [p.sessions]);

  // Areas: rectangles track whatever is currently on screen (so hiding one via
  // the filter also empties its region); the count row and the budget status
  // both read the wider scope/archived/query set so switching areas doesn't
  // make its own chip disappear before the click that picks it.
  const areaRects = useMemo(() => computeAreaRects(visible.nodes, pos, p.running, windows), [visible.nodes, pos, p.running, windows]);
  const areaCounts = useMemo(() => {
    const out = new Map<AreaId, number>();
    for (const n of layoutBase.nodes) if (n.area) out.set(n.area, (out.get(n.area) ?? 0) + 1);
    return AREA_IDS.filter((a) => out.has(a)).map((area) => ({ area, count: out.get(area)! }));
  }, [layoutBase.nodes]);
  // The usage numbers themselves come from the server (p.areaUsage, filled by
  // the canvas-area-usage frame — review #595 point 8): the client only
  // EVALUATES them against the budget, never recomputes its own estimate.
  const budgetStatus = useMemo(() => {
    const out: Partial<Record<AreaId, BudgetStatus>> = {};
    for (const area of AREA_IDS) {
      const status = evaluateBudget(p.areaUsage[area], p.board.budgets[area]);
      if (status.overCpu || status.overCtx) out[area] = status;
    }
    return out;
  }, [p.areaUsage, p.board.budgets]);
  const [budgetEditArea, setBudgetEditArea] = useState<AreaId | null>(null);
  const saveBudget = useCallback((area: AreaId, budget: AreaBudget) => {
    p.onCanvasBudgetSave(area, budget);
    setBudgetEditArea(null);
  }, [p]);

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

  // Same map, filled from the OTHER source: a flow that just started a card
  // as a new session server-side, which the browser never asked for and so
  // has no local draft to bind through runCard's own return value. The
  // cleanup effect above (keyed on p.running) prunes this exactly the same
  // way once the run shows up and finishes.
  useEffect(() => {
    const rec = pendingLaunch.current;
    let changed = false;
    for (const [cardId, { key, at }] of Object.entries(p.canvasFlowRuns)) {
      if (rec[cardId]?.key === key) continue;
      rec[cardId] = { key, addedAt: at };
      changed = true;
    }
    if (changed) setPendingTick((t) => t + 1);
  }, [p.canvasFlowRuns]);

  // Same absorption, from the OTHER server-initiated source: a card run in
  // "fork" reuse mode (session-reuse.ts). onLaunchFork doesn't know the new
  // session's real id up front (the server generates it) — canvasForkRuns is
  // filled once 'canvas-card-fork-ok' answers, keyed by cardId same as above.
  useEffect(() => {
    const rec = pendingLaunch.current;
    let changed = false;
    for (const [cardId, { key, at }] of Object.entries(p.canvasForkRuns)) {
      if (rec[cardId]?.key === key) continue;
      rec[cardId] = { key, addedAt: at };
      changed = true;
    }
    if (changed) setPendingTick((t) => t + 1);
  }, [p.canvasForkRuns]);

  // Every session as a kanban item (Kanban.tsx renders it alongside cards) —
  // deduped against a card's REAL edges (canvas-board.ts boundSessions) AND
  // pendingLaunch/canvasFlowRuns, which know about a card's session before
  // the graph does (refs.ts's transcript scan lags a poll or more behind a
  // fresh launch/flow fire). Without this a just-launched session briefly
  // doubled as its own standalone item next to the card already showing it.
  const extraBoundIds = useMemo(() => {
    const out = new Set<string>();
    for (const { key } of Object.values(pendingLaunch.current)) out.add(key);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pendingTick forces a
    // fresh Set when the pending map mutates; its value isn't read.
  }, [pendingTick]);
  const sessionItems = useMemo(() => deriveSessionItems({
    nodes: merged.nodes, edges: merged.edges, cards: p.board.cards, showAutomation, extraBoundIds, ...nodeStatusOpts,
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nodeStatusOpts is a
  // fresh object every render; its own members are the real deps.
  [merged, p.board.cards, showAutomation, extraBoundIds, p.running, p.board.sessionStatus, turnStartedAt, liveSessions, p.interrupted]);

  // A 'continue' reuse send runCard already moved to "doing" can still be
  // refused by the SERVER after the fact — the double-writer guard
  // (hasInteractiveClaude, #593) or a ctx/prompt-size gate that only exists
  // server-side. p.canvasSendError is the exact correlation #593 already
  // built for the canvas prompt bar's own restore-text flow (dispatch.ts
  // 'send' → 'send-reject' → useCockpit.ts); reusing it here (session+text+
  // timestamp match, via stuckContinueCard — see its own comment for why
  // `at` matters) is what moves the card OUT of "doing" instead of leaving
  // it stuck there forever for a turn that never started (review #597 point
  // 5). MUST consume via dismissCanvasSendError once handled (review #597
  // follow-up point 1): a session with no open terminal window never has
  // another consumer for this error, so an un-dismissed one sits in state
  // and — without the timestamp guard as a second line of defense — could
  // false-match a LATER, actually-successful run of the same card and bounce
  // it back to ToDo with a bogus "recusado" toast.
  useEffect(() => {
    const stuck = stuckContinueCard(p.board.cards, p.canvasSendError, buildContinuePrompt);
    if (!stuck) return;
    const message = p.canvasSendError?.message;
    delete pendingLaunch.current[stuck.id];
    setPendingTick((t) => t + 1);
    p.onCanvasCardSave(moveCard(stuck, 'todo', Date.now()));
    p.dismissCanvasSendError();
    toast(`O servidor recusou continuar essa sessão — "${stuck.title}" voltou pro ToDo: ${message}`, { tone: 'error', durationMs: 7000 });
  }, [p.canvasSendError, p.board.cards, p]);

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

  // A server-side auto-move (card-review.ts: doing→review on a clean turn
  // close) can land while the editor is open — the editor's own draft is a
  // snapshot frozen at `editCard` time and never re-syncs to later board
  // updates. If the user never touched the status control, keep whatever the
  // server has NOW instead of clobbering it with the stale snapshot's status.
  const saveCard = useCallback((card: CanvasCard) => {
    const status = resolveSaveStatus(card, draft?.card, cardOf(card.id));
    p.onCanvasCardSave({ ...card, status, updatedAt: Date.now() });
    setDraft(null);
  }, [p, draft, cardOf]);

  // Shared by the native 'fork' reuse mode and the 'continue'→fork fallback
  // below: forkId real chega depois via canvasForkRuns (absorvido acima);
  // "doing" já entra pra useCardTerminalAutoOpen abrir o terminal assim que a
  // edge marker-bound aparecer no grafo, igual a #593.
  const runFork = useCallback((card: CanvasCard, sessionId: string, prompt: string, toastMsg: string, failMsg: string) => {
    if (!p.onLaunchFork(sessionId, card.id, prompt)) {
      toast(failMsg, { tone: 'error', durationMs: 6000 });
      return;
    }
    p.onCanvasCardSave(moveCard(card, 'doing', Date.now()));
    setDraft(null);
    toast(toastMsg, { durationMs: 6000 });
  }, [p]);

  const runCard = useCallback((card: CanvasCard) => {
    // Reuse: 'continue' sends into an existing session's own turn (onSendTo,
    // #593 — triaged server-side if it's busy); 'fork' starts a NEW session
    // that inherits the target's whole transcript (--fork-session) without
    // touching it. Both skip the contexts/sessions re-seed (buildContinuePrompt)
    // — the target session already has that context, seeding it again would
    // just duplicate what it already read. 'new'/unset falls through below.
    const reuse = card.reuse;
    // The target can have gone from idle to running SINCE the card was saved
    // with mode 'continue' (CardReusePicker disables "continuar" on a running
    // candidate, but that's only true at PICK time — a card can sit in ToDo
    // for a while before "rodar" is actually clicked). Sending into a LIVE
    // turn routes through server triage (#593 routeSend), which can decide
    // 'priority' and KILL it — never right for an automated reuse pick, only
    // for a human deliberately typing into the prompt bar. Fall back to fork
    // instead: it never touches the live turn (review #597 point 4).
    if (reuse?.mode === 'continue' && reuse.sessionId && p.running.has(reuse.sessionId)) {
      runFork(
        card, reuse.sessionId, buildContinuePrompt(card),
        `Sessão em uso — forkado em vez de continuado: ${card.title}`,
        'Sessão em uso e sem conexão pra forkar: nada disparado.',
      );
      return;
    }
    if (reuse?.mode === 'continue' && reuse.sessionId) {
      const prompt = buildContinuePrompt(card);
      if (!p.onSendTo(reuse.sessionId, prompt)) {
        toast('Não deu pra continuar essa sessão: sem conexão com o servidor.', { tone: 'error', durationMs: 5000 });
        return;
      }
      pendingLaunch.current[card.id] = { key: reuse.sessionId, addedAt: Date.now() };
      setPendingTick((t) => t + 1);
      p.onCanvasCardSave(moveCard(card, 'doing', Date.now()));
      setDraft(null);
      toast(`Continuando sessão: ${card.title}`, { durationMs: 5000 });
      return;
    }
    if (reuse?.mode === 'fork' && reuse.sessionId) {
      runFork(
        card, reuse.sessionId, buildContinuePrompt(card),
        `Fork disparado: ${card.title}`,
        'Não deu pra forkar essa sessão: sem conexão com o servidor.',
      );
      return;
    }

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
  }, [byId, p, runFork]);

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

  const onSessionStatus = useCallback((sessionId: string, status: CardStatus) => {
    p.onCanvasSessionStatus(sessionId, status);
  }, [p]);

  return {
    mode, setMode, scope, setScope, archived, setArchived, query, setQuery,
    areaFilter, setAreaFilter, areaRects, areaCounts, budgetStatus, budgetEditArea, setBudgetEditArea, saveBudget,
    showAutomation, setShowAutomation,
    merged, visible, pos, windows, onDrop, worldBounds, coreBounds, byId, waiting,
    selected, selectedNodes, select, clearSelection,
    draft, setDraft, newDraft, editCard, saveCard, runCard, setStatus, deleteCard, cardSessions,
    sessionItems, onSessionStatus,
  };
}

export type { SessionKanbanItem };

export type CanvasRoute = ReturnType<typeof useCanvasRoute>;
