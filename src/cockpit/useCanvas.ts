import { useCallback, useState } from 'react';
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { CanvasBoard, CanvasCard, CanvasGraph, CanvasPos } from '../../shared/canvas';

export interface CanvasApi {
  canvasGraph: CanvasGraph | null;
  canvasBoard: CanvasBoard;
  canvasLoading: boolean;
  onCanvasGet: () => void;
  onCanvasPos: (pos: Record<string, CanvasPos>) => void;
  onCanvasPosReset: () => void;
  onCanvasCardSave: (card: CanvasCard) => void;
  onCanvasCardDelete: (id: string) => void;
  onMsg: (msg: ServerMsg) => boolean;
}

const EMPTY_BOARD: CanvasBoard = { cards: [], pos: {} };

export function useCanvas(send: (m: ClientMsg) => boolean): CanvasApi {
  const [canvasGraph, setGraph] = useState<CanvasGraph | null>(null);
  const [canvasBoard, setBoard] = useState<CanvasBoard>(EMPTY_BOARD);
  const [canvasLoading, setLoading] = useState(false);

  const onMsg = useCallback((msg: ServerMsg) => {
    if (msg.t === 'canvas-graph') { setGraph(msg.graph); setLoading(false); return true; }
    if (msg.t === 'canvas-board') { setBoard(msg.board); return true; }
    return false;
  }, []);

  const onCanvasGet = useCallback(() => { if (send({ t: 'canvas-get' })) setLoading(true); }, [send]);

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

  return { canvasGraph, canvasBoard, canvasLoading, onCanvasGet, onCanvasPos, onCanvasPosReset, onCanvasCardSave, onCanvasCardDelete, onMsg };
}
