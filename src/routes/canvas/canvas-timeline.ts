// Pure timeline math: "was this node alive around time T". Kept separate
// from useTimeline.ts (the stateful play/scrub hook) so it's testable with
// plain objects, no React involved.
import type { CanvasEdge, CanvasNode } from '../../../shared/canvas';

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

// Which node ids were "alive" at T, scrubbed to the past: every alive
// session, plus a context/card it touched — mirrors canvas-filter's own
// "seed then include neighbours" shape. Spread is deliberately narrow:
// - never through a 'conflict' edge (it links two SESSIONS and says nothing
//   about a context/card being relevant to either);
// - never session -> session at all (a session sitting next to an alive one
//   is not itself alive just because of that).
export function pastAliveIds(nodes: CanvasNode[], edges: CanvasEdge[], t: number, runningSince: Record<string, number>): Set<string> {
  const aliveSessions = new Set<string>();
  for (const n of nodes) if (n.kind === 'session' && aliveAt(n, t, runningSince[n.ref])) aliveSessions.add(n.id);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Set(aliveSessions);
  for (const e of edges) {
    if (e.kind === 'conflict') continue;
    const src = byId.get(e.source); const tgt = byId.get(e.target);
    if (aliveSessions.has(e.source) && tgt?.kind !== 'session') out.add(e.target);
    if (aliveSessions.has(e.target) && src?.kind !== 'session') out.add(e.source);
  }
  return out;
}
