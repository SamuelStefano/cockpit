import { useEffect, useRef, useState } from 'react';

export const TYPE_CPS = 45;

export const revealedCount = (total: number, shown: number, dtMs: number, cps = TYPE_CPS): number => Math.min(total, shown + (dtMs * cps) / 1000);

export function useTypewriter(text: string, instant: boolean): { shown: string; typing: boolean } {
  const [n, setN] = useState(0);
  const target = useRef(text.length);
  target.current = text.length;
  useEffect(() => {
    if (instant) return;
    let last = performance.now();
    let acc = 0;
    const id = setInterval(() => {
      const now = performance.now();
      acc = revealedCount(target.current, acc, now - last);
      last = now;
      setN(Math.floor(acc));
    }, 33);
    return () => clearInterval(id);
  }, [instant]);
  useEffect(() => { if (text.length < n) setN(0); }, [text, n]);
  const count = instant ? text.length : Math.min(n, text.length);
  return { shown: text.slice(0, count), typing: count < text.length };
}
