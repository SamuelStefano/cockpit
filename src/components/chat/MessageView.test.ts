import { describe, it, expect } from 'vitest';
import { lineDiff } from './MessageView';

describe('lineDiff', () => {
  it('all-add when old is empty', () => {
    expect(lineDiff('', 'a\nb')).toEqual([
      { t: 'add', s: 'a' },
      { t: 'add', s: 'b' },
    ]);
  });

  it('all-del when new is empty', () => {
    expect(lineDiff('a\nb', '')).toEqual([
      { t: 'del', s: 'a' },
      { t: 'del', s: 'b' },
    ]);
  });

  it('keeps unchanged lines as context', () => {
    expect(lineDiff('a\nb\nc', 'a\nb\nc')).toEqual([
      { t: 'ctx', s: 'a' },
      { t: 'ctx', s: 'b' },
      { t: 'ctx', s: 'c' },
    ]);
  });

  it('shows a single changed line as del + add, context preserved', () => {
    const rows = lineDiff('a\nb\nc', 'a\nX\nc');
    expect(rows).toEqual([
      { t: 'ctx', s: 'a' },
      { t: 'del', s: 'b' },
      { t: 'add', s: 'X' },
      { t: 'ctx', s: 'c' },
    ]);
  });

  it('detects a pure insertion in the middle', () => {
    const rows = lineDiff('a\nc', 'a\nb\nc');
    expect(rows).toEqual([
      { t: 'ctx', s: 'a' },
      { t: 'add', s: 'b' },
      { t: 'ctx', s: 'c' },
    ]);
  });

  it('reconstructs both sides exactly (del+ctx = old, add+ctx = new)', () => {
    const oldT = 'one\ntwo\nthree\nfour';
    const newT = 'one\ntwo-edited\nthree\nfive';
    const rows = lineDiff(oldT, newT);
    const reOld = rows.filter((r) => r.t !== 'add').map((r) => r.s).join('\n');
    const reNew = rows.filter((r) => r.t !== 'del').map((r) => r.s).join('\n');
    expect(reOld).toBe(oldT);
    expect(reNew).toBe(newT);
  });

  it('falls back to before/after block above the 300-line cap', () => {
    const big = Array.from({ length: 301 }, (_, i) => `l${i}`).join('\n');
    const rows = lineDiff(big, big);
    // sem LCS: tudo del seguido de tudo add, nenhum ctx
    expect(rows.every((r) => r.t !== 'ctx')).toBe(true);
    expect(rows.filter((r) => r.t === 'del').length).toBe(301);
    expect(rows.filter((r) => r.t === 'add').length).toBe(301);
  });
});
