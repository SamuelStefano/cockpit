import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { CanvasBoard, CanvasCard, CanvasFlow, CanvasGraph, CanvasPos, TermStats } from '../../shared/canvas';
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
  canvasTermStats: Record<string, TermStats>;
  onCanvasTermStats: (sessions: string[], terms: string[]) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

const EMPTY_BOARD: CanvasBoard = { cards: [], pos: {}, flows: [] };

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
  const loadingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posWriteAt = useRef<Record<string, number>>({});
  const cardWriteAt = useRef<Record<string, number>>({});
  const deleteWriteAt = useRef<Record<string, number>>({});
  const flowWriteAt = useRef<Record<string, number>>({});
  const flowDeleteWriteAt = useRef<Record<string, number>>({});

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
    if (msg.t === 'canvas-term-stats') { setTermStats(msg.stats); return true; }
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
        return { cards, pos, flows };
      });
      return true;
    }
    // Keyless/keyed 'error' frames are generic (turn failures, authz, rate
    // limit); canvas has no error variant of its own. Don't claim it — the
    // normal handler downstream still needs to show it — just stop waiting
    // on a canvas-get that will now never get its graph frame.
    if (msg.t === 'error' && loadingRef.current) { setStale(true); settle(); }
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
    send({ t: 'canvas-pos', pos });
  }, [send]);

  const onCanvasPosReset = useCallback(() => {
    posWriteAt.current = {};
    setBoard((b) => ({ ...b, pos: {} }));
    send({ t: 'canvas-pos-reset' });
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
    send({ t: 'canvas-card-save', card });
  }, [send]);

  const onCanvasCardDelete = useCallback((id: string) => {
    delete cardWriteAt.current[id];
    deleteWriteAt.current[id] = Date.now();
    setBoard((b) => ({ ...b, cards: b.cards.filter((c) => c.id !== id) }));
    send({ t: 'canvas-card-delete', id });
  }, [send]);

  const onCanvasFlowSave = useCallback((flow: CanvasFlow) => {
    delete flowDeleteWriteAt.current[flow.id];
    flowWriteAt.current[flow.id] = Date.now();
    setBoard((b) => {
      const i = b.flows.findIndex((f) => f.id === flow.id);
      return { ...b, flows: i < 0 ? [flow, ...b.flows] : b.flows.map((f) => (f.id === flow.id ? flow : f)) };
    });
    send({ t: 'canvas-flow-save', flow });
  }, [send]);

  const onCanvasFlowDelete = useCallback((id: string) => {
    delete flowWriteAt.current[id];
    flowDeleteWriteAt.current[id] = Date.now();
    setBoard((b) => ({ ...b, flows: b.flows.filter((f) => f.id !== id) }));
    send({ t: 'canvas-flow-delete', id });
  }, [send]);

  const onCanvasTermStats = useCallback((sessions: string[], terms: string[]) => {
    send({ t: 'canvas-term-stats', sessions, terms });
  }, [send]);

  return {
    canvasGraph, canvasBoard, canvasLoading, canvasLoadingSince, canvasStale,
    onCanvasGet, onCanvasPos, onCanvasPosReset, onCanvasCardSave, onCanvasCardDelete,
    onCanvasFlowSave, onCanvasFlowDelete, canvasFlowFired, canvasFlowRuns,
    canvasTermStats, onCanvasTermStats, onMsg,
  };
}
