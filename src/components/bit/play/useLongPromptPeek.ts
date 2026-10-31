import { useEffect, useRef } from 'react';
import { shouldPeek } from './long-prompt';

interface Args { play: (id: 'peek') => boolean; allowed: boolean; stageBusy: () => boolean }

// Reads only the length of the focused composer, never its content.
export function useLongPromptPeek({ play, allowed, stageBusy }: Args): void {
  const live = useRef({ play, allowed, stageBusy });
  live.current = { play, allowed, stageBusy };
  useEffect(() => {
    let timer = 0;
    let lastPeek = 0;
    let lastKey = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLTextAreaElement | null;
      if (!t || t.tagName !== 'TEXTAREA') return;
      lastKey = Date.now();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const now = Date.now();
        const el = document.activeElement as HTMLTextAreaElement | null;
        if (!el || el.tagName !== 'TEXTAREA') return;
        if (shouldPeek({ length: el.value.length, now, lastKey, lastPeek, busy: live.current.stageBusy(), allowed: live.current.allowed }) && live.current.play('peek')) lastPeek = now;
      }, 2100);
    };
    window.addEventListener('keydown', onKey, { passive: true, capture: true });
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', onKey, { capture: true }); };
  }, []);
}
