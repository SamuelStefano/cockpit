import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { AreaBudget, AreaId, CanvasBoard, CanvasCard, CanvasFlow, CanvasGraph, CanvasPos, CardStatus, OrchestratorActivity, OrchestratorInfo, SessionPeek, TermStats } from '../../shared/canvas';
import { AREA_LABELS } from '../../shared/canvas';
import type { AreaUsage } from '../../shared/canvas-budget';
import { toast } from '../components/primitives';

export interface CanvasApi {
  canvasGraph: CanvasGraph | null;
  canvasBoard: CanvasBoard;
  canvasLoading: boolean;
  canvasLoadingSince: number | null;
  canvasStale: boolean;
  onCanvasGet: () => void;
  onCanvasPos: (pos: Record<string, CanvasPos>) => void;
  onCanvasPosReset: () => void;
  onCanvasCardSave: (card: CanvasCard) => void;
  onCanvasCardDelete: (id: string) => void;
  onCanvasSessionStatus: (sessionId: string, status: CardStatus) => void;
  // Done column bulk triage ("completar antigos (N)", canvas review item 2):
  // ONE wire frame for the whole batch instead of one onCanvasSessionStatus
  // call per session.
  onCanvasSessionStatusBulk: (sessionIds: string[], status: CardStatus) => void;
  // Kanban drawer "ocultar" — board-persisted (canvas review item 2), holds
  // across devices instead of the old per-device localStorage list.
  onCanvasHideSession: (sessionId: string) => void;
  onCanvasUnhideAllSessions: () => void;
  onCanvasFlowSave: (flow: CanvasFlow) => void;
  onCanvasFlowDelete: (id: string) => void;
  // flowId -> ts of the last `canvas-flow-fired` broadcast, so the edge layer
  // can pulse the arrow that just delivered a prompt server-side.
  canvasFlowFired: Record<string, number>;
  // cardId -> the `new-<uuid>` run key a card-target flow just started, so
  // useCanvasRoute can bind it the same way it binds a client-launched
  // runCard (pendingLaunch) — without this the kanban has no way to know a
  // server-triggered card run is "rodando" until the sessions list catches
  // up on its own.
  canvasFlowRuns: Record<string, { key: string; at: number }>;
  onCanvasBudgetSave: (area: AreaId, budget: AreaBudget) => void;
  canvasTermStats: Record<string, TermStats>;
  onCanvasTermStats: (sessions: string[], terms: string[]) => void;
  // CardEditor's reuse-pool lookup (session-reuse.ts): transcript-tail-only,
  // never touches the CPU sample store 'canvas-term-stats' owns.
  onCanvasCtxStats: (sessions: string[]) => void;
  // Server-authoritative per-area usage (same computation the autopause loop
  // acts on), scoped to whatever ids the LAST onCanvasTermStats call asked
  // about. The client never estimates this itself (review #595 point 8).
  canvasAreaUsage: Partial<Record<AreaId, AreaUsage>>;
  // Fetched independently of the canvas-get graph (see 'orchestrator-get' in
  // shared/protocol.ts) — undefined = not answered yet, null = answered, no
  // Orchestrator configured. Used by the normal chat view's banner: it
  // shouldn't have to wait on (or trigger) the whole admin-only graph build
  // just to know whether the open session IS the Orchestrator's.
  orchestratorInfo: OrchestratorInfo | null | undefined;
  onOrchestratorReconnect: () => void;
  // The dock's "Em andamento" panel — only requested while it's open and
  // expanded (useOrchestratorActivityPoll), never on every reconnect.
  orchestratorActivity: OrchestratorActivity | null;
  onOrchestratorActivityGet: () => void;
  // Sessions working in a `cockpit-cv-*` tmux shell (server-pushed 'cv-live').
  cvLiveSessionIds: string[];
  // Same push: a cv shell that's ALIVE (tmux + process) but idle — waiting on
  // Samuel, not done. Optional field server-side (older backend omits it).
  cvIdleSessionIds: string[];
  // Kanban drawer transcript reads, by session id — null = unreadable.
  sessionPeeks: Record<string, SessionPeek | null>;
  onSessionPeek: (sessionId: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

const EMPTY_BOARD: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: {}, sessionStatus: {}, hiddenSessions: [] };

// server/ws/dispatch.ts runs message handlers unawaited and reads the board
// outside any write chain: a `canvas-board` frame answering an earlier
// canvas-get (or another client's write) can land AFTER a local optimistic
// change and blow it away until the next refresh. There's no wire revision
// to tell an authoritative frame from a stale one (that needs a server/
// protocol change, out of scope here), so this is a client-only mitigation:
// prefer the local value for anything the user touched in the last
// WRITE_GRACE_MS, and let the server win once that window passes.
const WRITE_GRACE_MS = 1500;

// A backend that predates canvas-get answers nothing at all for it (no
// default case in the server switch). A current one answers `canvas-board`
// at once, before the slow graph build, so that frame is the "supported"
// signal; the graph itself gets a much longer ceiling because the first scan
// after a deploy re-reads every transcript (~25s measured on this box).
const CANVAS_ACK_TIMEOUT_MS = 8_000;
const CANVAS_GET_TIMEOUT_MS = 120_000;

export function useCanvas(send: (m: ClientMsg) => boolean): CanvasApi {
  const [canvasGraph, setGraph] = useState<CanvasGraph | null>(null);
  const [canvasBoard, setBoard] = useState<CanvasBoard>(EMPTY_BOARD);
  const [canvasLoading, setLoading] = useState(false);
  const [canvasLoadingSince, setLoadingSince] = useState<number | null>(null);
  const [canvasStale, setStale] = useState(false);
  const [canvasTermStats, setTermStats] = useState<Record<string, TermStats>>({});
  const [canvasFlowFired, setFlowFired] = useState<Record<string, number>>({});
  const [canvasFlowRuns, setFlowRuns] = useState<Record<string, { key: string; at: number }>>({});
  const [canvasAreaUsage, setAreaUsage] = useState<Partial<Record<AreaId, AreaUsage>>>({});
  const [orchestratorInfo, setOrchestratorInfo] = useState<OrchestratorInfo | null | undefined>(undefined);
  // Board writes made while the socket is down. They used to be sent into the
  // void: the optimistic card showed, and the first board after reconnect (past
  // the write grace) dropped it, prompt and all, with no warning. Queued here
  // and replayed on the next open, with their grace timestamps refreshed so a
  // board snapshot racing the replay does not drop them either.
  const pendingWrites = useRef<ClientMsg[]>([]);
  const write = useCallback((m: ClientMsg) => {
    if (send(m)) return;
    pendingWrites.current.push(m);
    if (m.t === 'canvas-card-save' || m.t === 'canvas-flow-save') toast('Sem conexão — a mudança vai quando reconectar', { tone: 'error' });
  }, [send]);
  const onOrchestratorReconnect = useCallback(() => {
    send({ t: 'orchestrator-get' });
    const queued = pendingWrites.current;
    pendingWrites.current = [];
    const now = Date.now();
    for (const m of queued) {
      if (m.t === 'canvas-card-save') cardWriteAt.current[m.card.id] = now;
      if (m.t === 'canvas-card-delete') deleteWriteAt.current[m.id] = now;
      if (m.t === 'canvas-pos') for (const id of Object.keys(m.pos)) posWriteAt.current[id] = now;
      if (m.t === 'canvas-flow-save') flowWriteAt.current[m.flow.id] = now;
      if (m.t === 'canvas-flow-delete') flowDeleteWriteAt.current[m.id] = now;
      if (!send(m)) pendingWrites.current.push(m);
    }
  }, [send]);
  const [orchestratorActivity, setOrchestratorActivity] = useState<OrchestratorActivity | null>(null);
  const onOrchestratorActivityGet = useCallback(() => { send({ t: 'orchestrator-activity-get' }); }, [send]);
  const [cvLiveSessionIds, setCvLive] = useState<string[]>([]);
  const [cvIdleSessionIds, setCvIdle] = useState<string[]>([]);
  const [sessionPeeks, setSessionPeeks] = useState<Record<string, SessionPeek | null>>({});
  const onSessionPeek = useCallback((sessionId: string) => { send({ t: 'canvas-session-peek', sessionId }); }, [send]);
  const loadingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posWriteAt = useRef<Record<string, number>>({});
  const cardWriteAt = useRef<Record<string, number>>({});
  const deleteWriteAt = useRef<Record<string, number>>({});
  const flowWriteAt = useRef<Record<string, number>>({});
  const flowDeleteWriteAt = useRef<Record<string, number>>({});
  const sessionStatusWriteAt = useRef<Record<string, number>>({});
  // Single timestamp, not per-id like sessionStatusWriteAt: hide/unhide-all
  // are rare, deliberate actions (not a drag stream), so one grace window for
  // the whole list is enough to stop a stale canvas-board frame from
  // clobbering a hide that just landed.
  const hiddenWriteAt = useRef(0);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (ackTimerRef.current) { clearTimeout(ackTimerRef.current); ackTimerRef.current = null; }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const settle = useCallback(() => {
    clearTimer();
    loadingRef.current = false;
    setLoading(false);
    setLoadingSince(null);
  }, [clearTimer]);

  const onMsg = useCallback((msg: ServerMsg) => {
    // MERGED into the existing map, never a full replace (review #597
    // follow-up point 2): 'canvas-term-stats' answers only the ids THIS
    // round's caller asked about (dispatch.ts's `requested`), and with two
    // independent pollers now sharing this state (useTermStatsPoll's window
    // poll, CardEditor's onCanvasCtxStats below) a hard `setTermStats(msg.
    // stats)` on EITHER one would wipe out whatever the OTHER had just
    // populated — windows flashing 0%/the ranking flipping every round. Each
    // key this message DOES include is a FULL TermStats (collectTermStats
    // always sets cpu/rssMb/procs), so a per-key overwrite is correct here.
    if (msg.t === 'canvas-term-stats') {
      setTermStats((prev) => ({ ...prev, ...msg.stats }));
      return true;
    }
    // The ctx-only reuse-pool lookup (session-reuse.ts, server/canvas/
    // term-stats.ts collectCtxOnly): each entry is a PARTIAL patch
    // (contextTokens/model/lastAt only, no cpu/rssMb/procs — that request
    // never scans /proc). Spreading `patch` over `{cpu:0,rssMb:0,procs:0,
    // ...prev[id]}` fills in real numbers for a session that already has an
    // open-window entry and only ever defaults to 0 for one that's never
    // been polled otherwise — it can never CLOBBER a real cpu/rss reading
    // with a stale/zero one the way a full-map replace did.
    if (msg.t === 'canvas-ctx-stats') {
      setTermStats((prev) => {
        const next = { ...prev };
        for (const [id, patch] of Object.entries(msg.stats)) {
          const base = prev[id] ?? { cpu: 0, rssMb: 0, procs: 0 };
          next[id] = { ...base, ...patch };
        }
        return next;
      });
      return true;
    }
    if (msg.t === 'canvas-area-usage') { setAreaUsage(msg.usage); return true; }
    if (msg.t === 'canvas-flow-fired') {
      setFlowFired((f) => ({ ...f, [msg.flowId]: msg.at }));
      // Server only ever sends this minimal event (never the whole board —
      // every other card's prompt and flow's template would fan out to every
      // socket for nothing); patch just this flow's own counters locally.
      setBoard((b) => ({
        ...b,
        flows: b.flows.map((f) => (f.id === msg.flowId ? { ...f, fires: msg.fires, lastFiredAt: msg.at } : f)),
      }));
      return true;
    }
    if (msg.t === 'canvas-flow-run') {
      setFlowRuns((r) => ({ ...r, [msg.cardId]: { key: msg.runKey, at: Date.now() } }));
      return true;
    }
    if (msg.t === 'canvas-flow-failed') {
      // Dedicated admin-only frame (server/ws/canvas-clients.ts), never the
      // generic keyless {t:'error'}: that one makes every tab's onMsg call
      // endHandoff() and, if it lands mid a canvas-get, marks the canvas
      // stale — neither is right for a background flow failure. The toast
      // lives here, not in a reducer-style board patch, because there's
      // nothing to patch: this is a notification, not board state.
      toast(msg.message, { tone: 'error', durationMs: 6000 });
      return true;
    }
    if (msg.t === 'canvas-graph') { setGraph(msg.graph); setStale(false); settle(); return true; }
    if (msg.t === 'orchestrator-info') { setOrchestratorInfo(msg.info ?? null); return true; }
    if (msg.t === 'orchestrator-activity') { setOrchestratorActivity(msg.activity); return true; }
    if (msg.t === 'cv-live') { setCvLive(msg.sessionIds); setCvIdle(msg.idleSessionIds ?? []); return true; }
    if (msg.t === 'canvas-session-peek') { setSessionPeeks((prev) => ({ ...prev, [msg.sessionId]: msg.peek })); return true; }
    // Slim patch (card-review.ts auto-moving a card to "review"): update just
    // that card's status locally instead of waiting for a full canvas-board —
    // the server only sends this one field, not the whole board, on purpose.
    if (msg.t === 'canvas-card-status') {
      setBoard((b) => {
        const i = b.cards.findIndex((c) => c.id === msg.cardId);
        if (i < 0 || b.cards[i].status === msg.status) return b;
        // A user-initiated write in flight for this exact card (drag, editor
        // save) wins over the server's patch for the same grace window as a
        // full board frame — same rule as the `canvas-board` branch below.
        if (Date.now() - (cardWriteAt.current[msg.cardId] ?? 0) < WRITE_GRACE_MS) return b;
        const cards = [...b.cards];
        cards[i] = { ...cards[i], status: msg.status };
        return { ...b, cards };
      });
      return true;
    }
    // Slim broadcast for a session move made in ANOTHER tab/device (server/ws/
    // dispatch.ts's canvas-session-status, canvas review item 12a) — same
    // write-grace rule as canvas-card-status above: a local optimistic write
    // still in its grace window wins over this frame for the SAME id.
    if (msg.t === 'canvas-session-status') {
      setBoard((b) => {
        if (Date.now() - (sessionStatusWriteAt.current[msg.sessionId] ?? 0) < WRITE_GRACE_MS) return b;
        return { ...b, sessionStatus: { ...b.sessionStatus, [msg.sessionId]: { status: msg.status, at: msg.at } } };
      });
      return true;
    }
    // Same broadcast, batched: "completar antigos (N)" in another tab moves
    // every id at once — apply each, still respecting per-id write grace.
    if (msg.t === 'canvas-session-status-bulk') {
      setBoard((b) => {
        const now = Date.now();
        const sessionStatus = { ...b.sessionStatus };
        let changed = false;
        for (const id of msg.sessionIds) {
          if (now - (sessionStatusWriteAt.current[id] ?? 0) < WRITE_GRACE_MS) continue;
          sessionStatus[id] = { status: msg.status, at: msg.at };
          changed = true;
        }
        return changed ? { ...b, sessionStatus } : b;
      });
      return true;
    }
    if (msg.t === 'canvas-board') {
      if (ackTimerRef.current) { clearTimeout(ackTimerRef.current); ackTimerRef.current = null; }
      const now = Date.now();
      // Live flow runs the server already knows about — a tab that (re)connects
      // mid-run (F5, a second tab, /canvas opened after the flow fired) would
      // otherwise never see the card as running: canvas-flow-run is a one-shot
      // broadcast at fire time, sent before this tab even existed. Merge by
      // cardId, same shape the one-shot event already produces, so
      // useCanvasRoute's pendingLaunch absorption (keyed on cardId->key) needs
      // no separate code path for either source.
      const flowRuns = msg.flowRuns ?? [];
      if (flowRuns.length) {
        setFlowRuns((r) => {
          let changed = false;
          const next = { ...r };
          for (const run of flowRuns) {
            if (next[run.cardId]?.key === run.runKey) continue;
            next[run.cardId] = { key: run.runKey, at: now };
            changed = true;
          }
          return changed ? next : r;
        });
      }
      setBoard((prev) => {
        const pos = { ...msg.board.pos };
        for (const [id, at] of Object.entries(posWriteAt.current)) {
          if (now - at >= WRITE_GRACE_MS) { delete posWriteAt.current[id]; continue; }
          if (id in prev.pos) pos[id] = prev.pos[id]; else delete pos[id];
        }
        let cards = msg.board.cards;
        const prevById = new Map(prev.cards.map((c) => [c.id, c]));
        cards = cards
          .map((c) => {
            const at = cardWriteAt.current[c.id];
            if (at === undefined || now - at >= WRITE_GRACE_MS) return c;
            const local = prevById.get(c.id);
            return local && local.updatedAt >= c.updatedAt ? local : c;
          })
          .filter((c) => {
            const at = deleteWriteAt.current[c.id];
            return at === undefined || now - at >= WRITE_GRACE_MS;
          });
        for (const id of Object.keys(cardWriteAt.current)) if (now - cardWriteAt.current[id] >= WRITE_GRACE_MS) delete cardWriteAt.current[id];
        for (const id of Object.keys(deleteWriteAt.current)) if (now - deleteWriteAt.current[id] >= WRITE_GRACE_MS) delete deleteWriteAt.current[id];
        // Flows have no updatedAt (fires/lastFiredAt are server-bumped, not
        // client-edited), so — same as pos — a write in flight simply wins
        // over whatever this frame carries for that id.
        // `?? []`: a server from before this feature shipped answers
        // canvas-board with no `flows` key at all (same defense readBoard
        // already has server-side for a pre-flows file on disk).
        let flows = msg.board.flows ?? [];
        const prevFlowById = new Map(prev.flows.map((f) => [f.id, f]));
        flows = flows
          .map((f) => {
            const at = flowWriteAt.current[f.id];
            if (at === undefined || now - at >= WRITE_GRACE_MS) return f;
            return prevFlowById.get(f.id) ?? f;
          })
          .filter((f) => {
            const at = flowDeleteWriteAt.current[f.id];
            return at === undefined || now - at >= WRITE_GRACE_MS;
          });
        for (const id of Object.keys(flowWriteAt.current)) if (now - flowWriteAt.current[id] >= WRITE_GRACE_MS) delete flowWriteAt.current[id];
        for (const id of Object.keys(flowDeleteWriteAt.current)) if (now - flowDeleteWriteAt.current[id] >= WRITE_GRACE_MS) delete flowDeleteWriteAt.current[id];
        // `?? {}`: same pre-feature-server defense as `flows` above.
        const sessionStatus = { ...(msg.board.sessionStatus ?? {}) };
        for (const [sid, at] of Object.entries(sessionStatusWriteAt.current)) {
          if (now - at >= WRITE_GRACE_MS) { delete sessionStatusWriteAt.current[sid]; continue; }
          if (sid in prev.sessionStatus) sessionStatus[sid] = prev.sessionStatus[sid]; else delete sessionStatus[sid];
        }
        // Budgets have no optimistic-write grace window (see onCanvasBudgetSave):
        // the incoming frame is always authoritative for them.
        // `?? {}`: a server that predates budgets sends no key; reading budgets[area] would crash the canvas.
        // `?? []`: same pre-feature-server defense — a server that predates
        // board-persisted hides sends no `hiddenSessions` key at all.
        const hiddenSessions = now - hiddenWriteAt.current < WRITE_GRACE_MS ? prev.hiddenSessions : (msg.board.hiddenSessions ?? []);
        return { cards, pos, flows, budgets: msg.board.budgets ?? {}, sessionStatus, hiddenSessions };
      });
      return true;
    }
    // Keyless/keyed 'error' frames are generic (turn failures, authz, rate
    // limit); canvas has no error variant of its own. Don't claim it — the
    // normal handler downstream still needs to show it — just stop waiting
    // on a canvas-get that will now never get its graph frame.
    if (msg.t === 'error' && loadingRef.current) { setStale(true); settle(); }
    // Server-initiated (the autopause loop, not a reply to anything this tab
    // sent): a toast on whichever tab is open, wherever the stop happened.
    if (msg.t === 'canvas-budget-paused') {
      toast(`Área ${AREA_LABELS[msg.area]} estourou o orçamento: parou "${msg.sessionTitle}" (${msg.reason}).`, { tone: 'error', durationMs: 8000 });
      return true;
    }
    // A Deck->DFL status push exhausted its retries (server/canvas/
    // dfl-status-sync.ts). The persistent "sync pendente" badge lives on the
    // card itself (dfl.error, via the canvas-board frame that always follows
    // this); this is only the one-shot notification.
    if (msg.t === 'canvas-dfl-sync-error') {
      toast(`Sync DFL falhou: ${msg.message}`, { tone: 'error', durationMs: 8000 });
      return true;
    }
    return false;
  }, [settle]);

  const onCanvasGet = useCallback(() => {
    if (!send({ t: 'canvas-get' })) return;
    clearTimer();
    setStale(false);
    loadingRef.current = true;
    setLoading(true);
    setLoadingSince(Date.now());
    timeoutRef.current = setTimeout(() => { setStale(true); settle(); }, CANVAS_GET_TIMEOUT_MS);
    ackTimerRef.current = setTimeout(() => { setStale(true); settle(); }, CANVAS_ACK_TIMEOUT_MS);
  }, [send, clearTimer, settle]);

  // Positions are applied locally at once; the server copy only matters on reload.
  const onCanvasPos = useCallback((pos: Record<string, CanvasPos>) => {
    const now = Date.now();
    for (const id of Object.keys(pos)) posWriteAt.current[id] = now;
    setBoard((b) => ({ ...b, pos: { ...b.pos, ...pos } }));
    write({ t: 'canvas-pos', pos });
  }, [send]);

  const onCanvasPosReset = useCallback(() => {
    posWriteAt.current = {};
    setBoard((b) => ({ ...b, pos: {} }));
    write({ t: 'canvas-pos-reset' });
  }, [send]);

  // Optimistic: a card dragged across the kanban must not snap back while the
  // server round-trip is in flight; the broadcast that follows is authoritative.
  const onCanvasCardSave = useCallback((card: CanvasCard) => {
    delete deleteWriteAt.current[card.id];
    cardWriteAt.current[card.id] = Date.now();
    setBoard((b) => {
      const i = b.cards.findIndex((c) => c.id === card.id);
      return { ...b, cards: i < 0 ? [card, ...b.cards] : b.cards.map((c) => (c.id === card.id ? card : c)) };
    });
    write({ t: 'canvas-card-save', card });
  }, [send]);

  const onCanvasCardDelete = useCallback((id: string) => {
    delete cardWriteAt.current[id];
    deleteWriteAt.current[id] = Date.now();
    setBoard((b) => ({ ...b, cards: b.cards.filter((c) => c.id !== id) }));
    write({ t: 'canvas-card-delete', id });
  }, [send]);

  // Optimistic, same shape as onCanvasCardSave: the drag/click lands at once,
  // the broadcast that follows (or doesn't, offline) is authoritative.
  const onCanvasSessionStatus = useCallback((sessionId: string, status: CardStatus) => {
    const at = Date.now();
    sessionStatusWriteAt.current[sessionId] = at;
    setBoard((b) => ({ ...b, sessionStatus: { ...b.sessionStatus, [sessionId]: { status, at } } }));
    write({ t: 'canvas-session-status', sessionId, status });
  }, [send]);

  // Same optimistic shape, batched: applies the SAME entry to every id at
  // once instead of looping onCanvasSessionStatus (one wire frame, not N).
  const onCanvasSessionStatusBulk = useCallback((sessionIds: string[], status: CardStatus) => {
    if (!sessionIds.length) return;
    const at = Date.now();
    for (const id of sessionIds) sessionStatusWriteAt.current[id] = at;
    setBoard((b) => {
      const sessionStatus = { ...b.sessionStatus };
      for (const id of sessionIds) sessionStatus[id] = { status, at };
      return { ...b, sessionStatus };
    });
    write({ t: 'canvas-session-status-bulk', sessionIds, status });
  }, [send]);

  const onCanvasHideSession = useCallback((sessionId: string) => {
    hiddenWriteAt.current = Date.now();
    setBoard((b) => (b.hiddenSessions.includes(sessionId) ? b : { ...b, hiddenSessions: [...b.hiddenSessions, sessionId] }));
    write({ t: 'canvas-session-hide', sessionId });
  }, [send]);

  const onCanvasUnhideAllSessions = useCallback(() => {
    hiddenWriteAt.current = Date.now();
    setBoard((b) => ({ ...b, hiddenSessions: [] }));
    write({ t: 'canvas-session-unhide-all' });
  }, [send]);

  const onCanvasFlowSave = useCallback((flow: CanvasFlow) => {
    delete flowDeleteWriteAt.current[flow.id];
    flowWriteAt.current[flow.id] = Date.now();
    setBoard((b) => {
      const i = b.flows.findIndex((f) => f.id === flow.id);
      return { ...b, flows: i < 0 ? [flow, ...b.flows] : b.flows.map((f) => (f.id === flow.id ? flow : f)) };
    });
    write({ t: 'canvas-flow-save', flow });
  }, [send]);

  const onCanvasFlowDelete = useCallback((id: string) => {
    delete flowWriteAt.current[id];
    flowDeleteWriteAt.current[id] = Date.now();
    setBoard((b) => ({ ...b, flows: b.flows.filter((f) => f.id !== id) }));
    write({ t: 'canvas-flow-delete', id });
  }, [send]);

  const onCanvasTermStats = useCallback((sessions: string[], terms: string[]) => {
    send({ t: 'canvas-term-stats', sessions, terms });
  }, [send]);

  // CardEditor's reuse-pool lookup (session-reuse.ts, useCardReuse.ts) —
  // deliberately its OWN message, not onCanvasTermStats: see the
  // 'canvas-ctx-stats' ClientMsg comment (shared/protocol.ts) for why.
  const onCanvasCtxStats = useCallback((sessions: string[]) => {
    send({ t: 'canvas-ctx-stats', sessions });
  }, [send]);

  // No optimistic update: unlike a card/pos drag, a budget edit is rare and
  // its popover is already closed by the caller on submit — a brief round-trip
  // before the chip updates is not the glitch a snapped-back drag would be.
  const onCanvasBudgetSave = useCallback((area: AreaId, budget: AreaBudget) => {
    write({ t: 'canvas-budget-save', area, budget });
  }, [send]);

  return {
    canvasGraph, canvasBoard, canvasLoading, canvasLoadingSince, canvasStale,
    onCanvasGet, onCanvasPos, onCanvasPosReset, onCanvasCardSave, onCanvasCardDelete, onCanvasSessionStatus,
    onCanvasSessionStatusBulk, onCanvasHideSession, onCanvasUnhideAllSessions,
    onCanvasFlowSave, onCanvasFlowDelete, canvasFlowFired, canvasFlowRuns, onCanvasBudgetSave,
    canvasTermStats, onCanvasTermStats, onCanvasCtxStats, canvasAreaUsage,
    orchestratorInfo, onOrchestratorReconnect, orchestratorActivity, onOrchestratorActivityGet, cvLiveSessionIds, cvIdleSessionIds, sessionPeeks, onSessionPeek, onMsg,
  };
}
