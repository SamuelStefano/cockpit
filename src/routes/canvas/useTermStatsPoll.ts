import { useEffect, useRef } from 'react';
import type { CanvasNode } from '../../../shared/canvas';

const POLL_MS = 3000;

// Asks the server for the open windows' numbers while the canvas is visible.
// Ids go through a ref so a new window joins the next poll without restarting
// the interval (a restart would skew the CPU window the server measures over).
export function useTermStatsPoll(windows: CanvasNode[], connected: boolean, request: (sessions: string[], terms: string[]) => void) {
  const ids = useRef({ sessions: [] as string[], terms: [] as string[] });
  ids.current = {
    sessions: windows.filter((n) => n.kind === 'session').map((n) => n.ref),
    terms: windows.filter((n) => n.kind === 'shell').map((n) => n.ref),
  };
  const any = windows.length > 0;
  useEffect(() => {
    if (!connected || !any) return;
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      request(ids.current.sessions, ids.current.terms);
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [connected, any, request]);
}
