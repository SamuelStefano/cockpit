import type { CanvasNode, TermStats } from '../../../shared/canvas';
import { ctxPct } from './term-stats-view';

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
