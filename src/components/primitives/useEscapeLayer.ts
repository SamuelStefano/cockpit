import { useEffect, useRef } from 'react';

// Open overlays (Modal, Drawer, side sheets), most recent last. Only the top one
// answers Escape: with a plain window listener each, one Esc in a modal opened
// from a menu closed the modal AND the menu (or both of two stacked modals).
const layers: object[] = [];

export function useEscapeLayer(open: boolean, onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const me = {};
    layers.push(me);
    // Capture phase: runs before the bubble-phase dismiss handlers of whatever
    // opened this overlay, and marks the event handled so those skip it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      if (layers[layers.length - 1] !== me) return;
      e.preventDefault();
      close.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const i = layers.indexOf(me);
      if (i >= 0) layers.splice(i, 1);
    };
  }, [open]);
}
