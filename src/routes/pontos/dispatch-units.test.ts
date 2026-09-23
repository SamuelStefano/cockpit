import { describe, it, expect } from 'vitest';
import { sanitizeDrafts, type DflDraft } from '../../../shared/dfl-drafts';
import { epicUnit, deliveryUnit, selectionUnit } from './dispatch-units';

// d1 = t0 (sent), t1 · d2 = t2
const draft = (): DflDraft => sanitizeDrafts([{
  id: 'ep-1', title: 'E', status: 'draft', createdAt: 0,
  tasks: [
    { id: 't0', title: 'a', points: 1, refs: [], status: 'dispatched' },
    { id: 't1', title: 'b', points: 1, refs: [] },
    { id: 't2', title: 'c', points: 1, refs: [] },
  ],
  deliveries: [{ id: 'd1', title: 'D1', taskIds: ['t0', 't1'] }, { id: 'd2', title: 'D2', taskIds: ['t2'] }],
}])[0];

describe('dispatch units', () => {
  it('whole epic: every task when nothing was sent, else only what is pending', () => {
    const fresh = { ...draft(), tasks: draft().tasks.map((t) => ({ ...t, status: 'draft' as const })) };
    expect(epicUnit(fresh)).toEqual({ draft: fresh });
    expect(epicUnit(draft())?.taskIds).toEqual(['t1', 't2']);
  });

  it('one delivery: its pending tasks only', () => {
    expect(deliveryUnit(draft(), 'd1')?.taskIds).toEqual(['t1']);
    expect(deliveryUnit(draft(), 'd2')?.taskIds).toEqual(['t2']);
  });

  it('selection: drops tasks already sent; nothing pending → null', () => {
    expect(selectionUnit(draft(), new Set(['t0', 't2']))?.taskIds).toEqual(['t2']);
    expect(selectionUnit(draft(), new Set(['t0']))).toBeNull();
    const sent = { ...draft(), tasks: draft().tasks.map((t) => ({ ...t, status: 'created' as const })) };
    expect(epicUnit(sent)).toBeNull();
  });
});
