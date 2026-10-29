import { useEffect, useRef, useState } from 'react';

export const ALL_CLEAR_HOLD_MS = 5000;

// True for a few seconds after everything pending (running turns, questions waiting on
// the user, queued messages) drops to zero from non-zero: the "tudo em dia" beat.
export function useAllClear(pending: number): boolean {
  const [clear, setClear] = useState(false);
  const prev = useRef(pending);
  useEffect(() => {
    const cleared = prev.current > 0 && pending === 0;
    prev.current = pending;
    if (pending > 0) { setClear(false); return; }
    if (!cleared) return;
    setClear(true);
    const t = setTimeout(() => setClear(false), ALL_CLEAR_HOLD_MS);
    return () => clearTimeout(t);
  }, [pending]);
  return clear;
}
