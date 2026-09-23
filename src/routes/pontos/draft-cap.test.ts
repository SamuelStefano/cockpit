import { describe, it, expect } from 'vitest';
import { draftCap, sortDrafts, pendingTotals, draftProgress, suggestSplit } from './draft-cap';
import { sanitizeDrafts, type DflDraft, type DraftStatus } from '../../../shared/dfl-drafts';

const d = (id: string, pts: number[], status: DraftStatus = 'draft', createdAt = 0): DflDraft => sanitizeDrafts([{
  id, title: id, status, createdAt, tasks: pts.map((p, i) => ({ id: `${id}${i}`, title: 't', points: p, refs: [] })),
}])[0];

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

  it('a half-sent epic weighs only what is still pending and reads as partial', () => {
    const half = d('h', [4, 6]);
    half.tasks[1] = { ...half.tasks[1], status: 'dispatched' };
    expect(pendingTotals([half], 75)).toMatchObject({ count: 1, points: 4 });
    expect(draftProgress(half)).toBe('partial');
    expect(draftProgress(d('p', [1]))).toBe('draft');
    expect(draftProgress(d('q', [1], 'created'))).toBe('created');
  });
});

describe('suggestSplit', () => {
  it('moves the tail that no longer fits so the first epic ends at or under the cap', () => {
    expect(suggestSplit(d('s', [30, 30, 20, 10]), 75)).toEqual(['s2', 's3']);
  });

  it('suggests nothing when the epic fits or one task alone is over', () => {
    expect(suggestSplit(d('f', [10, 20]), 75)).toEqual([]);
    expect(suggestSplit(d('g', [80, 1]), 75)).toEqual([]);
  });

  it('never moves a task already sent to the agent', () => {
    const x = d('x', [40, 30, 2]);
    x.tasks[2] = { ...x.tasks[2], status: 'dispatched' };
    expect(suggestSplit(x, 75)).toEqual(['x1']);
  });
});
