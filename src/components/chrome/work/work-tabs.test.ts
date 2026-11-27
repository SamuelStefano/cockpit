import { describe, expect, it } from 'vitest';
import { workTabsFor } from './work-tabs';

describe('workTabsFor', () => {
  it('gives root every tab', () => {
    expect(workTabsFor('root').map((t) => t.id)).toEqual(['kanban', 'canvas', 'prs', 'pontos']);
  });

  it('hides the root-only tabs from an admin', () => {
    expect(workTabsFor('admin').map((t) => t.id)).toEqual(['kanban', 'canvas']);
  });

  it('gives a student nothing', () => {
    expect(workTabsFor('student')).toEqual([]);
  });
});
