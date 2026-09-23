import { deliveryTasks, draftPoints, type DflDraft, type DraftStatus } from '../../../shared/dfl-drafts';
import { centsFromPoints } from './money';
import { EPIC_CAP_CENTS } from './epic-cap';

export interface DraftCap {
  points: number;
  valueCents: number;
  capCents: number;
  overCents: number;   // how much passes the per-epic cap (R$ 5k): split the epic
  over: boolean;
}

// Rule 1 applied BEFORE the epic exists: a staged epic worth more than the cap
// must be split in two before it goes to DFL, never trimmed.
export function draftCap(d: DflDraft, pointValue: number, capCents = EPIC_CAP_CENTS): DraftCap {
  const points = draftPoints(d);
  const valueCents = centsFromPoints(points, pointValue);
  const overCents = Math.max(0, valueCents - capCents);
  return { points, valueCents, capCents, overCents, over: overCents > 0 };
}

const ORDER: Record<DraftStatus, number> = { draft: 0, dispatched: 1, created: 2 };

// Pending work first; what the agent already took goes to the bottom.
export function sortDrafts(drafts: DflDraft[]): DflDraft[] {
  return [...drafts].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.createdAt - b.createdAt);
}

export type DraftProgress = 'draft' | 'partial' | 'dispatched' | 'created';

// 'partial' = some deliveries/tasks already went to the agent, others did not.
export function draftProgress(d: DflDraft): DraftProgress {
  const pending = d.tasks.filter((t) => t.status === 'draft').length;
  if (d.status !== 'draft') return d.status;
  return pending && pending < d.tasks.length ? 'partial' : 'draft';
}

export const pendingIds = (d: DflDraft): string[] => d.tasks.filter((t) => t.status === 'draft').map((t) => t.id);

export interface DraftTotals { count: number; points: number; valueCents: number; overCount: number }

// What still waits to go to DFL: only pending tasks count, so a half-sent epic
// weighs what is left of it.
export function pendingTotals(drafts: DflDraft[], pointValue: number): DraftTotals {
  let points = 0;
  let count = 0;
  let overCount = 0;
  for (const d of drafts) {
    const pend = d.tasks.filter((t) => t.status === 'draft');
    if (!pend.length) continue;
    count++;
    points += draftPoints({ tasks: pend });
    if (draftCap(d, pointValue).over) overCount++;
  }
  points = Math.round(points * 100) / 100;
  return { count, points, valueCents: centsFromPoints(points, pointValue), overCount };
}

// The tail of the epic (in delivery order) that no longer fits the cap: moving it
// to a second epic leaves the first one at or under R$ 5k. Empty when the epic
// fits, or when a single task alone is over (nothing sensible to move).
export function suggestSplit(d: DflDraft, pointValue: number, capCents = EPIC_CAP_CENTS): string[] {
  const ordered = d.deliveries.flatMap((dl) => deliveryTasks(d, dl.id));
  let acc = 0;
  for (let i = 0; i < ordered.length; i++) {
    acc += centsFromPoints(ordered[i].points, pointValue);
    if (acc > capCents) return i === 0 ? [] : ordered.slice(i).map((t) => t.id);
  }
  return [];
}
