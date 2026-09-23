import { useCallback, useRef, useState } from 'react';
import type { CanvasPos } from '../../../shared/canvas';
import type { View } from './useCanvasViewport';

const CLICK_SLOP = 4;

// A press on a node either drags it (moved past the slop → persist the drop) or
// is a click (select). Positions under drag live here so only the drop hits the
// server; the board copy takes over once the drop is saved.
export function useNodeDrag(
  viewRef: React.MutableRefObject<View>,
  pos: Record<string, CanvasPos>,
  onDrop: (p: Record<string, CanvasPos>) => void,
  onClick: (id: string, additive: boolean) => void,
) {
  const [live, setLive] = useState<Record<string, CanvasPos>>({});
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean; additive: boolean } | null>(null);

  const onNodeDown = useCallback((e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = pos[id];
    if (!p) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false, additive: e.shiftKey || e.metaKey || e.ctrlKey };
  }, [pos]);

  const onNodeMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx; const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
    d.moved = true;
    const k = viewRef.current.k;
    setLive({ [d.id]: { x: d.ox + dx / k, y: d.oy + dy / k } });
  }, [viewRef]);

  const onNodeUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { onClick(d.id, d.additive); return; }
    setLive((cur) => {
      if (cur[d.id]) onDrop({ [d.id]: cur[d.id] });
      return {};
    });
  }, [onClick, onDrop]);

  return { live, onNodeDown, onNodeMove, onNodeUp };
}
