import { useCallback, useRef, useState } from 'react';
import { toWorld, type View } from './useCanvasViewport';

export interface PortDrag { from: string; x: number; y: number }

// Drag from a node's output port draws a rubber-band line in world space and
// creates a flow on drop over a valid target. Deliberately separate from
// useNodeDrag: a press on the port must never start a node drag or a pan
// (stopPropagation + preventDefault), and a drop is judged against whatever
// `[data-node]` sits under the pointer, not a single tracked id.
export function useFlowPorts(
  viewRef: React.MutableRefObject<View>,
  surfaceRef: React.RefObject<HTMLElement | null>,
  canDrop: (id: string) => boolean,
  onCreate: (from: string, to: string) => void,
) {
  const [portDrag, setPortDrag] = useState<PortDrag | null>(null);
  const fromRef = useRef<string | null>(null);

  const worldAt = useCallback((clientX: number, clientY: number) => {
    const r = surfaceRef.current?.getBoundingClientRect();
    return toWorld(viewRef.current, clientX - (r?.left ?? 0), clientY - (r?.top ?? 0));
  }, [viewRef, surfaceRef]);

  const onPortDown = useCallback((e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fromRef.current = id;
    setPortDrag({ from: id, ...worldAt(e.clientX, e.clientY) });
  }, [worldAt]);

  const onPortMove = useCallback((e: React.PointerEvent) => {
    if (!fromRef.current) return;
    const p = worldAt(e.clientX, e.clientY);
    setPortDrag((d) => (d ? { ...d, x: p.x, y: p.y } : d));
  }, [worldAt]);

  const onPortUp = useCallback((e: React.PointerEvent) => {
    const from = fromRef.current;
    fromRef.current = null;
    setPortDrag(null);
    if (!from) return;
    // Plural, not elementFromPoint: dropping exactly on another node's port
    // (or on this arrow's own click chip) put THAT small element on top —
    // elementFromPoint only sees it, `.closest('[data-node]')` finds nothing
    // (a port/chip isn't inside a node card's DOM), and the drop silently
    // failed even though the pointer was visibly over the target card.
    // Walking the whole z-stack finds the node underneath regardless of what
    // else is drawn on top of that exact pixel.
    const stack = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(e.clientX, e.clientY) : [];
    let target: string | undefined;
    for (const el of stack) {
      const node = el.closest?.('[data-node]');
      if (node) { target = (node as HTMLElement).dataset.node; break; }
    }
    if (target && target !== from && canDrop(target)) onCreate(from, target);
  }, [canDrop, onCreate]);

  // The port itself (not the surface) owns the capture, so it's the one that
  // gets notified if the browser revokes it without a normal pointerup ever
  // firing (OS-level gesture interrupt, alt-tab mid-drag, …) — without this
  // the rubber band stays drawn forever with nothing left to cancel it.
  const onPortLostCapture = useCallback(() => {
    fromRef.current = null;
    setPortDrag(null);
  }, []);

  return { portDrag, onPortDown, onPortMove, onPortUp, onPortLostCapture };
}
