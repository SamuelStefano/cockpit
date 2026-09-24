// Which session a `canvas-card-fork` (--fork-session) child was born from.
// Process-lifetime, same shape and same "durable enough" reasoning as
// card-sessions.ts: the only place this relation is ever produced is
// dispatch.ts's 'canvas-card-fork' handler (server/ws/dispatch.ts), right
// after runParkedInBackground hands back the real forkId — nothing else
// records it, and a forked transcript carries no marker of its own parent
// (the CLI's --fork-session just copies history into a new session id, it
// doesn't write anything distinguishing back into the JSONL). Lost on a
// server restart, same tradeoff card-sessions.ts already makes.

const parentBySession = new Map<string, string>();

export function bindForkSession(childSessionId: string, parentSessionId: string): void {
  parentBySession.set(childSessionId, parentSessionId);
}

export function forkParentOf(childSessionId: string): string | undefined {
  return parentBySession.get(childSessionId);
}

// Snapshot for buildCanvasGraph (server/canvas/index.ts) — a copy, not the
// live map, so the graph builder can never mutate this module's state.
export function allForkParents(): Map<string, string> {
  return new Map(parentBySession);
}

// Test-only: the map is module-level/process-lifetime.
export function __resetForkSessions(): void {
  parentBySession.clear();
}
