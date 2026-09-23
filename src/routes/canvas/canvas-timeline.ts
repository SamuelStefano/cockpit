// Pure timeline math: "was this node alive around time T". Kept separate
// from useTimeline.ts (the stateful play/scrub hook) so it's testable with
// plain objects, no React involved.
import type { CanvasEdge, CanvasNode } from '../../../shared/canvas';
import { isAutomationSession } from './canvas-automation';

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

// The exec scope's node set (canvas-filter.ts) seeds off "alive right NOW"
// (running/waiting/open window/done-recent) — scrubbing the timeline back
// doesn't change that seed, so a session alive AT T but idle right now never
// even enters the node set to be dimmed in. This rebuilds the exec node set
// for a scrubbed instant instead: every session alive at T (aliveAt), the
// contexts it directly touched, and the card that launched it if any.
// Deliberately narrower than pastAliveIds' own spread above (which follows
// EVERY non-conflict edge kind, session->session included via a shared
// context) — restricted to 'read'/'write' for contexts, same as the exec
// filter, so a topic/link neighbour never sneaks a whole cluster back in.
// The 'card' edge runs card->session (canvas-board.ts), so that one lookup is
// reversed: a card stays visible for the session it launched even if the
// card itself is already Completed, which the live exec seed never shows.
export interface PastExecOpts {
  // Same defaults/meaning as canvas-filter.ts's FilterOpts: false shows
  // automation noise, `running` exempts a session that's live RIGHT NOW from
  // the archived filter (an archived session someone just resumed is still
  // worth showing), archived=true disables the filter entirely.
  showAutomation?: boolean;
  archived?: boolean;
  running?: Set<string>;
}

export function pastExecIds(
  nodes: CanvasNode[], edges: CanvasEdge[], t: number, runningSince: Record<string, number>, o: PastExecOpts = {},
): Set<string> {
  const allowed = (n: CanvasNode) => o.archived || !n.archived || (o.running?.has(n.ref) ?? false);
  const showAuto = o.showAutomation ?? false;

  const aliveSessions = new Set<string>();
  for (const n of nodes) {
    if (n.kind !== 'session' || !allowed(n)) continue;
    if (!showAuto && isAutomationSession({ title: n.title, subtitle: n.subtitle })) continue;
    if (aliveAt(n, t, runningSince[n.ref])) aliveSessions.add(n.id);
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Indexed once (O(edges)) — same technique canvas-filter.ts's exec branch
  // uses instead of scanning the whole edge list per seed.
  const bySource = new Map<string, CanvasEdge[]>();
  for (const e of edges) bySource.set(e.source, [...(bySource.get(e.source) ?? []), e]);

  const out = new Set(aliveSessions);
  for (const s of aliveSessions) {
    for (const e of bySource.get(s) ?? []) {
      if (e.kind !== 'read' && e.kind !== 'write') continue;
      const target = byId.get(e.target);
      if (target?.kind === 'context' && allowed(target)) out.add(e.target);
    }
  }
  for (const e of edges) if (e.kind === 'card' && aliveSessions.has(e.target)) out.add(e.source);
  return out;
}
