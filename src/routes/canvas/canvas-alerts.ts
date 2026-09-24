import { isCronPing, type CanvasNode, type TermStats } from '../../../shared/canvas';
import { ctxPct } from './term-stats-view';
import { KANBAN_STALE_MS, type SessionKanbanItem } from './kanban-items';

// Two alert states can put a pulsing border on a session's window/node: waiting
// on the user (AskUserQuestion pending) or a context window past the danger
// line. A session shows at most one — waiting is worse than "about to run out
// of room", so it wins when both are true.
export const CTX_ALERT_PCT = 80;
export type AlertKind = 'waiting' | 'context' | null;

export function sessionAlert(waiting: boolean, stats?: Pick<TermStats, 'contextTokens' | 'model'>): AlertKind {
  if (waiting) return 'waiting';
  const pct = stats ? ctxPct(stats) : null;
  return pct !== null && pct >= CTX_ALERT_PCT ? 'context' : null;
}

export function alertLabel(kind: AlertKind, pct: number | null): string {
  if (kind === 'waiting') return 'esperando você';
  if (kind === 'context') return `contexto ${pct}%`;
  return '';
}

// Top-bar counts: waiting counts every visible session (the flag comes from
// the session list, known regardless of whether its window is open); the hot
// context count only ever counts what's open — ctxPct needs live TermStats,
// which is only polled for open windows (useTermStatsPoll).
export function countWaiting(nodes: CanvasNode[], waiting: Set<string>): number {
  return nodes.filter((n) => n.kind === 'session' && waiting.has(n.ref)).length;
}

export function countHotContext(nodes: CanvasNode[], stats: Record<string, TermStats>): number {
  return nodes.filter((n) => n.kind === 'session' && sessionAlert(false, stats[n.ref]) === 'context').length;
}

// "Who needs me" (TL feedback, 2026-09-24): a single first row above the
// kanban/map/chain switch that answers it in one glance, instead of three
// mismatched numbers (inventory badge, HUD's `p.running`-only count, kanban
// strip's unscoped total). One count per chip, mutually exclusive — mirrors
// deriveSessionStatus's own precedence (kanban-items.ts): running beats
// waiting beats a crashed-idle session beats one that just closed cleanly.
export interface StatusChip {
  count: number;
  // First matching item's node id, for the chip's click-to-focus — undefined
  // when count is 0 (nothing to focus).
  firstNodeId?: string;
}

export interface StatusSummary {
  running: StatusChip;
  waiting: StatusChip;
  errored: StatusChip;
  doneRecent: StatusChip;
}

// Cron reset-pings (isCronPing) never count here even when "mostrar
// automações" is on — deriveSessionItems only drops them for that toggle's
// OWN purpose (decluttering the map/kanban), but this status line is meant to
// read like the sidebar always does: those sessions are noise, never a thing
// Samuel needs to look at.
export function summarizeStatus(items: SessionKanbanItem[], now: number): StatusSummary {
  const running: StatusChip = { count: 0 };
  const waiting: StatusChip = { count: 0 };
  const errored: StatusChip = { count: 0 };
  const doneRecent: StatusChip = { count: 0 };
  for (const item of items) {
    if (isCronPing({ title: item.title, snippet: item.subtitle })) continue;
    if (item.running) {
      running.count += 1;
      running.firstNodeId ??= item.nodeId;
    } else if (item.waitingOnUser) {
      waiting.count += 1;
      waiting.firstNodeId ??= item.nodeId;
    } else if (item.needsAttention) {
      errored.count += 1;
      errored.firstNodeId ??= item.nodeId;
    } else if (item.status === 'review' && now - item.mtime < KANBAN_STALE_MS) {
      doneRecent.count += 1;
      doneRecent.firstNodeId ??= item.nodeId;
    }
  }
  return { running, waiting, errored, doneRecent };
}
