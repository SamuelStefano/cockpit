import { useCallback, useState } from 'react';
import type { DflMcpsState } from '../../shared/dfl-mcps';

const KEY = 'deck.dflMcps.shown';

// The DFL catalog is noise for anyone outside DFL: the panel opens by itself only
// once a DFL server is configured, or after the user asks for it.
export function dflPanelOpen(state: DflMcpsState | null, optedIn: boolean): boolean {
  return optedIn || !!state?.hosts.some((h) => h.status !== 'missing');
}

function readOptIn(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function useDflPanelOpen(state: DflMcpsState | null) {
  const [optedIn, setOptedIn] = useState(readOptIn);
  const show = useCallback(() => {
    setOptedIn(true);
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ }
  }, []);
  return { open: dflPanelOpen(state, optedIn), show };
}
