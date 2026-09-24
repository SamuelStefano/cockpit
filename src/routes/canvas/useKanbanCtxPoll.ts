import { useEffect, useRef } from 'react';
import { triageSessionItems, type SessionKanbanItem } from './kanban-items';

const POLL_MS = 15_000;
// The tail-only lookup is cheap per id, but still one read per session — cap
// it at the same "board fits on screen" size Kanban.tsx's own triage already
// settles on, never the FULL sessionItems history.
const MAX_IDS = 40;

// The kanban's "is this cheap to continue or about to compact" signal
// (review item 8): ctx% only ever existed for a session with an open
// terminal window (useTermStatsPoll polls windows only). Reuses the same
// tail-only 'canvas-ctx-stats' lookup CardEditor's reuse picker already
// depends on (session-reuse.ts) so termStats fills in for whatever the
// kanban actually shows, without a second CPU-scanning poller. The response
// merges into the SAME termStats map Kanban.tsx already receives
// (src/cockpit/useCanvas.ts's 'canvas-ctx-stats' handler) — no new prop on
// the kanban item components is needed for the DATA to arrive; see this
// hook's own doc for what still needs to change on the render side.
export function useKanbanCtxPoll(items: SessionKanbanItem[], active: boolean, request: (sessions: string[]) => void) {
  const idsRef = useRef<string[]>([]);
  idsRef.current = triageSessionItems(items, Date.now()).visible.slice(0, MAX_IDS).map((i) => i.sessionId);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      if (idsRef.current.length) request(idsRef.current);
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [active, request]);
}
