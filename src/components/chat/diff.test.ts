import { describe, it, expect } from 'vitest';
import { lineDiff } from './diff';

describe('lineDiff', () => {
  it('marks every line as add when the old text is empty', () => {
    expect(lineDiff('', 'a\nb')).toEqual([
      { t: 'add', s: 'a' },
      { t: 'add', s: 'b' },
    ]);
  });

  it('marks every line as del when the new text is empty', () => {
    expect(lineDiff('a\nb', '')).toEqual([
      { t: 'del', s: 'a' },
      { t: 'del', s: 'b' },
    ]);
  });

  it('returns all context rows when nothing changed', () => {
    expect(lineDiff('a\nb', 'a\nb')).toEqual([
      { t: 'ctx', s: 'a' },
      { t: 'ctx', s: 'b' },
    ]);
  });

  it('interleaves a single changed line as del then add around context', () => {
    expect(lineDiff('a\nb\nc', 'a\nX\nc')).toEqual([
      { t: 'ctx', s: 'a' },
      { t: 'del', s: 'b' },
      { t: 'add', s: 'X' },
      { t: 'ctx', s: 'c' },
    ]);
  });

  it('detects a pure insertion in the middle via the LCS', () => {
    expect(lineDiff('a\nc', 'a\nb\nc')).toEqual([
      { t: 'ctx', s: 'a' },
      { t: 'add', s: 'b' },
      { t: 'ctx', s: 'c' },
    ]);
  });

  it('detects a pure deletion in the middle via the LCS', () => {
    expect(lineDiff('a\nb\nc', 'a\nc')).toEqual([
      { t: 'ctx', s: 'a' },
      { t: 'del', s: 'b' },
      { t: 'ctx', s: 'c' },
    ]);
  });

  it('falls back to del-all then add-all above the 300-line cap', () => {
    const old = Array.from({ length: 301 }, (_, i) => `o${i}`).join('\n');
    const neu = Array.from({ length: 2 }, (_, i) => `n${i}`).join('\n');
    const rows = lineDiff(old, neu);
    expect(rows.slice(0, 301).every((r) => r.t === 'del')).toBe(true);
    expect(rows.slice(301).every((r) => r.t === 'add')).toBe(true);
    expect(rows).toHaveLength(303);
  });
});
