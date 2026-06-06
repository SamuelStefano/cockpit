import { useEffect, useRef } from 'react';
import { usePersisted } from '../lib/persist';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function usePanelResize() {
  const [leftW, setLeftW] = usePersisted('panel.left', 17);
  const [rightW, setRightW] = usePersisted('panel.right', 37);
  const [leftCollapsed, setLeftCollapsed] = usePersisted('panel.leftCollapsed', false);
  const [rightCollapsed, setRightCollapsed] = usePersisted('panel.rightCollapsed', false);
  const rowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ which: string; startX: number; startLeft: number; startRight: number; w: number } | null>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const dx = ((e.clientX - d.startX) / d.w) * 100;
      if (d.which === 'left') setLeftW(clamp(d.startLeft + dx, 13, 28));
      else setRightW(clamp(d.startRight - dx, 24, 48));
    };
    const up = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
      document.querySelectorAll('.resizer.active').forEach((el) => el.classList.remove('active'));
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [setLeftW, setRightW]);

  const startDrag = (which: string) => (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rowRef.current) return;
    dragRef.current = { which, startX: e.clientX, startLeft: leftW, startRight: rightW, w: rowRef.current.offsetWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    (e.currentTarget as HTMLDivElement).classList.add('active');
  };

  return { rowRef, leftW, rightW, leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed, startDrag };
}
