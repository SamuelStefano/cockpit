import { useEffect, useRef } from 'react';
import { isEdgeOpenSwipe, type SwipePoint } from './primitives/swipe';

// Opens the drawer when a touch starts at the left edge and drags right. Safari
// tab mode keeps its own back-swipe on the very edge; the installed PWA does not.
export function useEdgeSwipeOpen(enabled: boolean, onOpen: () => void): void {
  const open = useRef(onOpen);
  open.current = onOpen;
  useEffect(() => {
    if (!enabled) return;
    let start: SwipePoint | null = null;
    const down = (e: TouchEvent) => { const t = e.touches[0]; start = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; };
    const up = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (start && isEdgeOpenSwipe(start, { x: t.clientX, y: t.clientY })) open.current();
      start = null;
    };
    document.addEventListener('touchstart', down, { passive: true });
    document.addEventListener('touchend', up, { passive: true });
    return () => { document.removeEventListener('touchstart', down); document.removeEventListener('touchend', up); };
  }, [enabled]);
}
