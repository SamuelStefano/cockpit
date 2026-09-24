import { useEffect } from 'react';

const POLL_MS = 10_000;

// Only asks the server while the panel is actually open — the scan behind it
// (server/canvas/orchestrator-activity.ts) is cheap but there's no reason to
// pay it on a tick nobody's looking at.
export function useOrchestratorActivityPoll(active: boolean, request: () => void) {
  useEffect(() => {
    if (!active) return;
    request();
    const t = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      request();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [active, request]);
}
