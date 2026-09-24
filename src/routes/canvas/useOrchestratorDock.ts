import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersisted } from '../../lib/persist';
import { clampDockWidth, DEFAULT_DOCK_WIDTH, isMobileWidth } from './orchestrator-dock';

// Docks the Orchestrator into a right sidebar: open + width persisted across
// reloads, resizable by dragging the left edge, toggled by Ctrl+. from
// anywhere on /canvas — not a text-editing combo, so it fires even with a
// terminal or the composer focused.
export function useOrchestratorDock() {
  const [open, setOpen] = usePersisted('canvas.orchestratorDock', false);
  const [width, setWidth] = usePersisted('canvas.orchestratorDockWidth', DEFAULT_DOCK_WIDTH);
  const [mobile, setMobile] = useState(() => isMobileWidth(window.innerWidth));
  const dragging = useRef(false);

  useEffect(() => {
    const onResize = () => setMobile(isMobileWidth(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggle = useCallback(() => setOpen((o) => !o), [setOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.key !== '.') return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  const startResize = useCallback((e: React.PointerEvent) => {
    if (mobile) return; // full-screen sheet on mobile — nothing to drag
    e.preventDefault();
    dragging.current = true;
    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return;
      setWidth(clampDockWidth(window.innerWidth - ev.clientX, window.innerWidth));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // A cancelled pointer (pen lifted off-screen, OS gesture) sends no pointerup:
    // the drag stayed live and the dock followed the next mouse move.
    window.addEventListener('pointercancel', onUp);
  }, [mobile, setWidth]);

  return { open, toggle, setOpen, width: clampDockWidth(width, window.innerWidth), mobile, startResize };
}

export type OrchestratorDock = ReturnType<typeof useOrchestratorDock>;
