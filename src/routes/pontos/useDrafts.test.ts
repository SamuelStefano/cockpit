import { describe, it, expect } from 'vitest';
import { sanitizeDrafts, type DflDraft } from '../../../shared/dfl-drafts';
import { unitStillDraft } from './useDrafts';

const draft = (status: 'draft' | 'dispatched' = 'draft'): DflDraft => sanitizeDrafts([{
  id: 'ep', title: 'Épico', status: 'draft', createdAt: 0,
  tasks: [{ id: 't0', title: 'A', points: 1, refs: [], status }, { id: 't1', title: 'B', points: 1, refs: [], status: 'draft' }],
}])[0];

describe('unitStillDraft', () => {
  it('lets a unit go when every task is still a draft in the live list', () => {
    expect(unitStillDraft({ draft: draft() }, [draft()])).toBe(true);
  });

  it('holds a unit another device already dispatched', () => {
    expect(unitStillDraft({ draft: draft() }, [draft('dispatched')])).toBe(false);
    expect(unitStillDraft({ draft: draft(), taskIds: ['t1'] }, [draft('dispatched')])).toBe(true);
  });

  it('holds a unit whose epic is gone', () => {
    expect(unitStillDraft({ draft: draft() }, [])).toBe(false);
  });
});
