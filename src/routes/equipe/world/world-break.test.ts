import { describe, it, expect } from 'vitest';
import { BREAK_AFTER_MS, breakPlace } from './world-break';

const MIN = 60_000;
const plazaSeconds = (id: string, fromMs: number, toMs: number): number[] => {
  const out: number[] = [];
  for (let t = fromMs; t < toMs; t += 1000) if (breakPlace(t, 0, id) === 'plaza') out.push(t);
  return out;
};

describe('breakPlace', () => {
  it('stays at the desk before 30 minutes and without an idle start', () => {
    expect(breakPlace(29 * MIN, 0, 'a')).toBe('desk');
    expect(breakPlace(5 * MIN, 0, 'a')).toBe('desk');
    expect(breakPlace(99 * MIN, undefined, 'a')).toBe('desk');
  });
  it('takes a 20-40 s stroll right after 30 minutes', () => {
    const t = plazaSeconds('a', BREAK_AFTER_MS, BREAK_AFTER_MS + 2 * MIN);
    expect(t.length).toBeGreaterThanOrEqual(20);
    expect(t.length).toBeLessThanOrEqual(40);
    expect(t[0]! - BREAK_AFTER_MS).toBeLessThanOrEqual(30_000);
    expect(breakPlace(BREAK_AFTER_MS + 2 * MIN, 0, 'a')).toBe('desk');
  });
  it('strolls again every 10-20 minutes', () => {
    const t = plazaSeconds('a', BREAK_AFTER_MS, 3 * 60 * MIN);
    const starts = t.filter((x, i) => i === 0 || x - t[i - 1]! > 1000);
    expect(starts.length).toBeGreaterThan(5);
    for (let i = 1; i < starts.length; i++) {
      const gap = starts[i]! - starts[i - 1]!;
      expect(gap).toBeGreaterThanOrEqual(10 * MIN + 20_000);
      expect(gap).toBeLessThanOrEqual(20 * MIN + 40_000);
    }
  });
  it('is deterministic per bot and differs between bots', () => {
    expect(plazaSeconds('a', BREAK_AFTER_MS, 60 * MIN)).toEqual(plazaSeconds('a', BREAK_AFTER_MS, 60 * MIN));
    expect(plazaSeconds('a', BREAK_AFTER_MS, 60 * MIN)).not.toEqual(plazaSeconds('zoro', BREAK_AFTER_MS, 60 * MIN));
  });
});
