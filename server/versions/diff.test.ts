import { describe, it, expect } from 'vitest';
import { unifiedDiff } from './diff';

describe('unifiedDiff', () => {
  it('is empty for equal texts', () => {
    expect(unifiedDiff('a\nb\n', 'a\nb\n')).toBe('');
    expect(unifiedDiff('', '')).toBe('');
  });

  it('marks a changed line with context and hunk header', () => {
    const d = unifiedDiff('a\nb\nc\n', 'a\nB\nc\n', 'v1', 'v2');
    expect(d.split('\n')).toEqual(['--- v1', '+++ v2', '@@ -1,3 +1,3 @@', ' a', '-b', '+B', ' c']);
  });

  it('handles pure additions and removals', () => {
    expect(unifiedDiff('', 'x\ny')).toContain('@@ -0,0 +1,2 @@\n+x\n+y');
    expect(unifiedDiff('x\ny', '')).toContain('@@ -1,2 +0,0 @@\n-x\n-y');
  });

  it('splits distant changes into separate hunks', () => {
    const base = Array.from({ length: 30 }, (_, i) => `l${i}`);
    const next = [...base];
    next[1] = 'X';
    next[28] = 'Y';
    const d = unifiedDiff(base.join('\n'), next.join('\n'));
    expect(d.match(/^@@/gm)).toHaveLength(2);
    expect(d).toContain('-l1\n+X');
    expect(d).toContain('-l28\n+Y');
  });

  it('falls back to replace-all on huge middles without blowing up', () => {
    const a = Array.from({ length: 2500 }, (_, i) => `a${i}`).join('\n');
    const b = Array.from({ length: 2500 }, (_, i) => `b${i}`).join('\n');
    const d = unifiedDiff(a, b);
    expect(d).toContain('-a0');
    expect(d).toContain('+b2499');
  });
});
