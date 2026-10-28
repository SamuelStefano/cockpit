import { useEffect, useRef, useState } from 'react';
import { DONE_HOLD_MS } from './turn-bit-state';

// True for a short beat after `active` falls: lets the mascot cheer once when work ends.
export function useJustDone(active: boolean): boolean {
  const [done, setDone] = useState(false);
  const prev = useRef(active);
  useEffect(() => {
    const ended = prev.current && !active;
    prev.current = active;
    if (active) { setDone(false); return; }
    if (!ended) return;
    setDone(true);
    const t = setTimeout(() => setDone(false), DONE_HOLD_MS);
    return () => clearTimeout(t);
  }, [active]);
  return done;
}
