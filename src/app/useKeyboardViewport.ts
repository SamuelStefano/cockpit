import { useEffect } from 'react';

const RATIO = 0.75;

// iOS Safari ignores interactive-widget=resizes-content: 100dvh keeps the full height, the
// keyboard covers the composer and the page pans. Pin the app to the visible viewport instead.
export function useKeyboardViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      if (vv.height < window.innerHeight * RATIO) root.style.setProperty('--app-height', `${Math.round(vv.height)}px`);
      else root.style.removeProperty('--app-height');
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      root.style.removeProperty('--app-height');
    };
  }, []);
}
