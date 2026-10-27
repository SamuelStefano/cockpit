import { useEffect, useRef } from 'react';
import { usePersisted } from '../lib/persist';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const LEFT_RANGE = [13, 28] as const;
export const LEFT_MIN_PX = 260;
export type PanelSide = 'left';

export function usePanelResize() {
  const [leftW, setLeftW] = usePersisted('panel.left', 17);
  const [leftCollapsed, setLeftCollapsed] = usePersisted('panel.leftCollapsed', false);
  const rowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ which: PanelSide; startX: number; startLeft: number; w: number } | null>(null);

  // Pointer events, not mouse: a touch laptop or an iPad in landscape gets the
  // desktop layout and could not drag the dividers at all.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      const dx = ((e.clientX - d.startX) / d.w) * 100;
      if (d.which === 'left') setLeftW(clamp(d.startLeft + dx, ...LEFT_RANGE));
    };
    const up = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      document.querySelectorAll('.resizer.active').forEach((el) => el.classList.remove('active'));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [setLeftW]);

  const startDrag = (which: PanelSide) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!rowRef.current) return;
    e.preventDefault();
    dragRef.current = { which, startX: e.clientX, startLeft: leftW, w: rowRef.current.offsetWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    (e.currentTarget as HTMLDivElement).classList.add('active');
  };

  // Keyboard resize for the focusable separators: arrows move the divider the
  // way it points, 1% per press (Shift = 5%).
  const nudge = (which: PanelSide, e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1);
    if (which === 'left') setLeftW((w) => clamp(w + step, ...LEFT_RANGE));
  };

  return { rowRef, leftW, leftCollapsed, setLeftCollapsed, startDrag, nudge };
}
