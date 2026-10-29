import { useRef, type TouchEvent } from 'react';

const HOLD_MS = 450;
const SLOP_PX = 10;

// Touch-only long press. Moving past the slop (a scroll) cancels it.
export function useLongPress(onLongPress: (() => void) | null) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  if (!onLongPress) return {};
  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0];
      origin.current = { x: t.clientX, y: t.clientY };
      cancel();
      timer.current = setTimeout(() => { timer.current = null; onLongPress(); }, HOLD_MS);
    },
    onTouchMove: (e: TouchEvent) => {
      const t = e.touches[0];
      const o = origin.current;
      if (o && Math.hypot(t.clientX - o.x, t.clientY - o.y) > SLOP_PX) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  };
}
