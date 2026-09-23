import { describe, it, expect } from 'vitest';
import { draftCap, sortDrafts, pendingTotals } from './draft-cap';
import type { DflDraft, DraftStatus } from '../../../shared/dfl-drafts';

const d = (id: string, pts: number[], status: DraftStatus = 'draft', createdAt = 0): DflDraft => ({
  id, title: id, status, createdAt, tasks: pts.map((p, i) => ({ id: `${id}${i}`, title: 't', points: p, refs: [] })),
});

describe('draftCap', () => {
  it('values the epic at the point value and flags what passes R$ 5.000', () => {
    expect(draftCap(d('a', [24]), 75)).toMatchObject({ points: 24, valueCents: 180_000, overCents: 0, over: false });
    expect(draftCap(d('b', [40, 30]), 75)).toMatchObject({ points: 70, valueCents: 525_000, overCents: 25_000, over: true });
  });

  it('exactly at the cap is not over', () => {
    expect(draftCap(d('c', [50]), 100).over).toBe(false);
  });
});

describe('sortDrafts / pendingTotals', () => {
  it('puts pending drafts first, then dispatched, then created', () => {
    const out = sortDrafts([d('x', [1], 'created', 1), d('y', [1], 'dispatched', 2), d('z', [1], 'draft', 3), d('w', [1], 'draft', 0)]);
    expect(out.map((x) => x.id)).toEqual(['w', 'z', 'y', 'x']);
  });

  it('sums only drafts still pending and counts the ones over the cap', () => {
    const t = pendingTotals([d('a', [1.5, 2]), d('b', [80]), d('c', [9], 'dispatched')], 75);
    expect(t).toEqual({ count: 2, points: 83.5, valueCents: 626_250, overCount: 1 });
  });
});
