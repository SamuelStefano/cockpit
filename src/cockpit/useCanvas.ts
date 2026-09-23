import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { CanvasBoard, CanvasCard, CanvasGraph, CanvasPos } from '../../shared/canvas';

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
  onMsg: (msg: ServerMsg) => boolean;
}

const EMPTY_BOARD: CanvasBoard = { cards: [], pos: {} };

// A backend that predates canvas-get answers nothing at all for it (no
// default case in the server switch): without a client-side ceiling the
// "Montando o grafo" screen waits forever. 20s comfortably covers a cold
// first scan (~9s) plus a slow build.
const CANVAS_GET_TIMEOUT_MS = 20_000;

export function useCanvas(send: (m: ClientMsg) => boolean): CanvasApi {
  const [canvasGraph, setGraph] = useState<CanvasGraph | null>(null);
  const [canvasBoard, setBoard] = useState<CanvasBoard>(EMPTY_BOARD);
  const [canvasLoading, setLoading] = useState(false);
  const [canvasLoadingSince, setLoadingSince] = useState<number | null>(null);
  const [canvasStale, setStale] = useState(false);
  const loadingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const settle = useCallback(() => {
    clearTimer();
    loadingRef.current = false;
    setLoading(false);
    setLoadingSince(null);
  }, [clearTimer]);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t === 'canvas-graph') { setGraph(msg.graph); setStale(false); settle(); return true; }
    if (msg.t === 'canvas-board') { setBoard(msg.board); return true; }
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
  }, [send, clearTimer, settle]);

  // Positions are applied locally at once; the server copy only matters on reload.
  const onCanvasPos = useCallback((pos: Record<string, CanvasPos>) => {
    setBoard((b) => ({ ...b, pos: { ...b.pos, ...pos } }));
    send({ t: 'canvas-pos', pos });
  }, [send]);

  const onCanvasPosReset = useCallback(() => {
    setBoard((b) => ({ ...b, pos: {} }));
    send({ t: 'canvas-pos-reset' });
  }, [send]);

  // Optimistic: a card dragged across the kanban must not snap back while the
  // server round-trip is in flight; the broadcast that follows is authoritative.
  const onCanvasCardSave = useCallback((card: CanvasCard) => {
    setBoard((b) => {
      const i = b.cards.findIndex((c) => c.id === card.id);
      return { ...b, cards: i < 0 ? [card, ...b.cards] : b.cards.map((c) => (c.id === card.id ? card : c)) };
    });
    send({ t: 'canvas-card-save', card });
  }, [send]);

  const onCanvasCardDelete = useCallback((id: string) => {
    setBoard((b) => ({ ...b, cards: b.cards.filter((c) => c.id !== id) }));
    send({ t: 'canvas-card-delete', id });
  }, [send]);

  return {
    canvasGraph, canvasBoard, canvasLoading, canvasLoadingSince, canvasStale,
    onCanvasGet, onCanvasPos, onCanvasPosReset, onCanvasCardSave, onCanvasCardDelete, onMsg,
  };
}
