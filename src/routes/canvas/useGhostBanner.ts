import { useCallback } from 'react';
import { usePersisted } from '../../lib/persist';
import { capRecent } from './canvas-board';

// Whether the ghost-summary strip is MOUNTED at all (TerminalWindow.tsx).
// Deliberately takes no `running`/`promptDisabled` — the strip reserves a
// fixed height (GhostSummaryBanner.tsx) so the terminal body beneath it, and
// the pty it drives, never resizes just because a turn started or stopped;
// only session/subtitle/dismissed (none of which flip every turn) may change
// whether it exists. `running`/`promptDisabled` only affect what's rendered
// INSIDE it (forced collapsed, "continuar" disabled) — see TerminalWindow.tsx.
export function shouldShowGhostBanner(session: boolean, dismissed: boolean, subtitle: string): boolean {
  return session && !dismissed && !!subtitle;
}

// Per-session dismissal persists across reopens/reloads (spec: "persist
// dismissal per session") — the collapse fold is a lighter, per-mount-only
// affordance and lives as plain useState in TerminalWindow, no need to
// remember it forever. Capped (capRecent) so months of dismissals don't
// bloat localStorage.
export function useGhostBanner(sessionRef: string) {
  const [dismissedIds, setDismissedIds] = usePersisted<string[]>('canvas.dismissedBanners', []);
  const dismissed = dismissedIds.includes(sessionRef);
  const dismiss = useCallback(() => {
    setDismissedIds((cur) => (cur.includes(sessionRef) ? cur : capRecent([...cur, sessionRef])));
  }, [sessionRef, setDismissedIds]);
  return { dismissed, dismiss };
}
