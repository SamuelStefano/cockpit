import { describe, expect, it } from 'vitest';
import { cutPatch, filesFromPages, mapStatus } from './pr-diff-parse';

describe('mapStatus', () => {
  it('maps GitHub statuses', () => {
    expect(['added', 'removed', 'renamed', 'modified', 'changed', 'copied'].map(mapStatus)).toEqual(['added', 'deleted', 'renamed', 'modified', 'modified', 'modified']);
  });
});

describe('cutPatch', () => {
  it('cuts at a line boundary', () => {
    expect(cutPatch('aaaa\nbbbb\ncccc', 12)).toEqual({ patch: 'aaaa\nbbbb', cut: true });
    expect(cutPatch('aaaa', 12)).toEqual({ patch: 'aaaa', cut: false });
  });
});

describe('filesFromPages', () => {
  it('maps files, keeps previousPath only for renames, leaves a missing patch undefined', () => {
    const { files, truncated } = filesFromPages([[
      { filename: 'b.ts', previous_filename: 'a.ts', status: 'renamed', additions: 1, deletions: 1, patch: '@@ x' },
      { filename: 'img.png', previous_filename: 'z', status: 'modified', additions: 0, deletions: 0 },
      { filename: 'gone.ts', status: 'removed', additions: 0, deletions: 3, patch: '-a' },
    ]]);
    expect(truncated).toBe(false);
    expect(files[0]).toEqual({ path: 'b.ts', previousPath: 'a.ts', change: 'renamed', additions: 1, deletions: 1, patch: '@@ x' });
    expect(files[1]).toEqual({ path: 'img.png', change: 'modified', additions: 0, deletions: 0 });
    expect(files[1].patch).toBeUndefined();
    expect(files[2].change).toBe('deleted');
  });

  it('caps one file and flags it, without truncating the diff', () => {
    const { files, truncated } = filesFromPages([[{ filename: 'a', status: 'added', patch: 'l1\nl2\nl3' }]], { fileMax: 5 });
    expect(files[0]).toMatchObject({ patch: 'l1', patchTruncated: true });
    expect(truncated).toBe(false);
  });

  it('drops patches past the total budget and flags the diff', () => {
    const p = 'x'.repeat(10);
    const { files, truncated } = filesFromPages([[
      { filename: 'a', status: 'added', patch: p }, { filename: 'b', status: 'added', patch: p }, { filename: 'c', status: 'added', patch: p },
    ]], { totalMax: 15 });
    expect(files.map((f) => f.path)).toEqual(['a', 'b', 'c']);
    expect(files[0].patch).toBe(p);
    expect(files[2].patch).toBeUndefined();
    expect(truncated).toBe(true);
  });
});
