import { useEffect, useRef } from 'react';

export const LOAD_DEBOUNCE_MS = 300;
export const REFRESH_MS = 8000;
export const LOAD_TIMEOUT_MS = 30000;

interface Pending { sentAt: number; thread: unknown }

// A request stays unanswered until the thread object changes; stop piling up new ones meanwhile, for 30s at most.
export function shouldLoad(pending: Pending | null, thread: unknown, now: number): boolean {
  return !pending || pending.thread !== thread || now - pending.sentAt >= LOAD_TIMEOUT_MS;
}

// Loads on selection (debounced, so stepping through desks does not spam) and when a turn ends;
// only a running session keeps refreshing.
export function useThreadLoader(sessionId: string, thread: unknown, running: boolean, connected: boolean, onLoadThread: (id: string) => void) {
  const pending = useRef<Pending | null>(null);
  const threadRef = useRef(thread);
  threadRef.current = thread;
  useEffect(() => {
    if (!connected) return;
    const load = () => {
      const now = Date.now();
      if (!shouldLoad(pending.current, threadRef.current, now)) return;
      pending.current = { sentAt: now, thread: threadRef.current };
      onLoadThread(sessionId);
    };
    const first = window.setTimeout(load, LOAD_DEBOUNCE_MS);
    const tick = running ? window.setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS) : undefined;
    return () => { window.clearTimeout(first); if (tick !== undefined) window.clearInterval(tick); };
  }, [connected, onLoadThread, sessionId, running]);
}
