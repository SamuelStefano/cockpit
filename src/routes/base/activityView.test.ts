import { describe, expect, it } from 'vitest';
import type { ActivityItem } from './activity';
import { buildView, groupFiles } from './activityView';

let n = 0;
const item = (over: Partial<ActivityItem>): ActivityItem => ({ id: `i${n++}`, kind: 'file', verb: 'Edited', target: '/a/x.ts', turn: 1, status: 'done', ...over });

describe('groupFiles', () => {
  it('makes one row per file, counts only what worked and keeps failures visible', () => {
    const groups = groupFiles([
      item({ verb: 'Wrote' }), item({ target: '/a/y.ts' }), item({ status: 'error' }), item({}), item({ kind: 'command', target: 'ls' }),
    ]);
    expect(groups.map((g) => g.path)).toEqual(['/a/x.ts', '/a/y.ts']);
    expect(groups[0]).toMatchObject({ edits: 2, failed: 1 });
    expect(groups[0].items).toHaveLength(3);
    expect(groups[1]).toMatchObject({ edits: 1, failed: 0 });
  });
  it('keeps a row without a diff in its group', () => {
    const [g] = groupFiles([item({ target: '/a/nb.ipynb' })]);
    expect(g.items[0].tool?.diff).toBeUndefined();
  });
});

describe('buildView', () => {
  const items = [item({ turn: 1 }), item({ turn: 1, kind: 'command' }), item({ turn: 2, kind: 'command' }), item({ turn: 2, kind: 'command', status: 'error' })];
  it('groups files only for the plain files filter', () => {
    expect(buildView(items, 'file', false, 10).groups).toHaveLength(1);
    expect(buildView(items, 'file', true, 10).groups).toBeNull();
  });
  it('lists newest first and keeps the failed filter', () => {
    const v = buildView(items, 'all', true, 10);
    expect(v.rows).toHaveLength(1);
    expect(buildView(items, 'all', false, 10).rows[0]).toBe(items[3]);
  });
  it('labels the oldest turn partial only when the cap cut it', () => {
    expect(buildView(items, 'all', false, 4).partialTurn).toBeNull();
    expect(buildView(items, 'all', false, 3).partialTurn).toBe(1);
    expect(buildView(items, 'all', false, 2).partialTurn).toBeNull();
  });
  it('summarizes turns before the filter', () => {
    expect(buildView(items, 'command', false, 10).turnLabels.get(1)).toBe('Turn 1 · 1 file · 1 command');
  });
});
