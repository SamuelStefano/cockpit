// Pure timeline math: "was this node alive around time T". Kept separate
// from useTimeline.ts (the stateful play/scrub hook) so it's testable with
// plain objects, no React involved.

export const TIMELINE_WINDOW_MS = 7 * 24 * 3600_000;
// A record's timestamp counts as "alive" a little before/after it too — a
// session that last wrote 29 minutes ago obviously still has the file open.
export const ALIVE_PAD_MS = 30 * 60_000;

export interface AliveNode {
  activity?: [number, number][];
}

// `runningSince`: if the node has a turn live right now and it started at or
// before `t`, the turn is presumed to still be spanning T (transcript
// activity lags a running turn by definition — the graph only has records up
// to the last completed write).
export function aliveAt(node: AliveNode, t: number, runningSince?: number): boolean {
  if (runningSince !== undefined && runningSince <= t) return true;
  const activity = node.activity;
  if (!activity || !activity.length) return false;
  return activity.some(([start, end]) => t >= start - ALIVE_PAD_MS && t <= end + ALIVE_PAD_MS);
}

// Always BRT regardless of the server/browser's own timezone — the VPS runs
// in UTC, and a scrubbed timestamp read as local time there would be 2-3h off.
export function fmtTimelineStamp(t: number): string {
  return new Date(t).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
