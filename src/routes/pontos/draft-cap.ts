import { draftPoints, type DflDraft, type DraftStatus } from '../../../shared/dfl-drafts';
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

export interface DraftTotals { count: number; points: number; valueCents: number; overCount: number }

export function pendingTotals(drafts: DflDraft[], pointValue: number): DraftTotals {
  const pending = drafts.filter((d) => d.status === 'draft');
  let points = 0;
  let overCount = 0;
  for (const d of pending) {
    const c = draftCap(d, pointValue);
    points += c.points;
    if (c.over) overCount++;
  }
  points = Math.round(points * 100) / 100;
  return { count: pending.length, points, valueCents: centsFromPoints(points, pointValue), overCount };
}
