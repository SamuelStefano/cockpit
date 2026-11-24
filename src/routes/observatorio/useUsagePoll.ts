import { useEffect, useRef } from 'react';

export const USAGE_POLL_MS = 60_000;

// /uso asked once on mount; with the page left open "custo hoje" froze at the
// first read. Re-ask every minute while connected and visible.
export function useUsagePoll(connected: boolean, request: () => void, ms = USAGE_POLL_MS): void {
  const req = useRef(request);
  req.current = request;
  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') req.current();
    }, ms);
    return () => clearInterval(id);
  }, [connected, ms]);
}
