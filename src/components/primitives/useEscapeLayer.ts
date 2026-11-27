import { useEffect, useRef } from 'react';

// Open overlays (Modal, Drawer, confirm dialogs, viewers), most recent last. Only
// the top one answers Escape: with a plain window listener each, one Esc in a
// modal opened from a menu closed the modal AND the menu, or both of two
// stacked modals.
const layers: object[] = [];

// A menu/popover (useDismiss) yields Escape while any layer is open: a modal
// opened from the menu sits on top of it.
export function escapeLayerOpen(): boolean {
  return layers.length > 0;
}

export function useEscapeLayer(open: boolean, onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const me = {};
    layers.push(me);
    // Bubble phase, not capture: an input inside the dialog that handles Escape
    // (inline rename, a picker) marks the event first and the dialog stays open.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      if (layers[layers.length - 1] !== me) return;
      e.preventDefault();
      close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const i = layers.indexOf(me);
      if (i >= 0) layers.splice(i, 1);
    };
  }, [open]);
}
