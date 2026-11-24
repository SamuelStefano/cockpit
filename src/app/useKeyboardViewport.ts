import { useEffect } from 'react';
import { viewportShrunk } from './keyboard-shrunk';

const SETTLE_MS = 350;

// iOS Safari ignores interactive-widget=resizes-content: 100dvh keeps the full height, the
// keyboard covers the composer and the page pans. Pin the app to the visible viewport instead.
export function useKeyboardViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      if (vv.scale <= 1 && viewportShrunk(vv.height, window.innerHeight, window.innerWidth)) root.style.setProperty('--app-height', `${Math.round(vv.height)}px`);
      else root.style.removeProperty('--app-height');
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    apply();
    // The keyboard animates after focus and a resize event is not guaranteed at its end.
    let settle = 0;
    const applyLater = () => { apply(); clearTimeout(settle); settle = window.setTimeout(apply, SETTLE_MS); };
    document.addEventListener('focusin', applyLater);
    document.addEventListener('focusout', applyLater);
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      clearTimeout(settle);
      document.removeEventListener('focusin', applyLater);
      document.removeEventListener('focusout', applyLater);
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      root.style.removeProperty('--app-height');
    };
  }, []);
}
