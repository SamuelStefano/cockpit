import type { SessionUsage } from '../../../shared/protocol';

export type UsageSortKey = 'cost' | 'output' | 'seen';
export type SortDir = 'asc' | 'desc';

const value = (r: SessionUsage, key: UsageSortKey): number =>
  key === 'cost' ? r.costUsd : key === 'output' ? r.outputTokens : r.lastTs;

export function sortUsage(rows: SessionUsage[], key: UsageSortKey, dir: SortDir): SessionUsage[] {
  return [...rows].sort((a, b) => (dir === 'asc' ? value(a, key) - value(b, key) : value(b, key) - value(a, key)));
}
