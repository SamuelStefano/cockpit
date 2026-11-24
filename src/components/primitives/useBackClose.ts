import { useEffect, useRef } from 'react';

let seq = 0;

// iOS back/edge-swipe pops history, not the overlay. While an overlay is open it
// owns one history entry: back closes the overlay instead of leaving the chat.
// Closing by any other means consumes that entry so the stack stays clean.
export function useBackClose(open: boolean, onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const key = `overlay-${++seq}`;
    history.pushState({ ...(history.state ?? {}), __overlay: key }, '');
    let popped = false;
    const onPop = () => {
      if ((history.state as { __overlay?: string } | null)?.__overlay === key) return;
      popped = true;
      close.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped && (history.state as { __overlay?: string } | null)?.__overlay === key) history.back();
    };
  }, [open]);
}
