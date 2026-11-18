import { describe, it, expect } from 'vitest';
import { BREAK_AFTER_MS, breakPlace, firstStrollStart, plazaBreakers, FIRST_JITTER_MS } from './world-break';

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
    const t = plazaSeconds('a', BREAK_AFTER_MS, BREAK_AFTER_MS + 11 * MIN);
    expect(t.length).toBeGreaterThanOrEqual(20);
    expect(t.length).toBeLessThanOrEqual(40);
    expect(t[0]! - BREAK_AFTER_MS).toBeLessThanOrEqual(10 * MIN);
    expect(breakPlace(BREAK_AFTER_MS + 11 * MIN, 0, 'a')).toBe('desk');
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

describe('first stroll spread', () => {
  it('starts 30-40 min after idle and is deterministic', () => {
    const starts = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const id = `bot-${i}`;
      const s = firstStrollStart(1000, id);
      expect(s).toBe(firstStrollStart(1000, id));
      expect(s - 1000).toBeGreaterThanOrEqual(BREAK_AFTER_MS);
      expect(s - 1000).toBeLessThanOrEqual(BREAK_AFTER_MS + FIRST_JITTER_MS);
      starts.add(s);
    }
    expect(starts.size).toBeGreaterThan(100);
  });
});

describe('plazaBreakers', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `bot-${i}`);
  const idle = ids.map((id) => ({ id, idleSince: 0 }));

  it('never puts more than 4 bots on the plaza', () => {
    let max = 0;
    let seen = 0;
    for (let now = 0; now <= 3 * 60 * MIN; now += 10_000) {
      const n = plazaBreakers(now, idle).size;
      max = Math.max(max, n);
      if (n > 0) seen++;
    }
    expect(max).toBeLessThanOrEqual(4);
    expect(seen).toBeGreaterThan(0);
  });

  it('keeps the slot of a bot that is already out', () => {
    const crowd = [...ids.slice(0, 19).map((id) => ({ id, idleSince: 0 })), { id: 'late', idleSince: 0 }];
    let kept = 0;
    for (let now = BREAK_AFTER_MS; now <= 3 * 60 * MIN; now += 1000) {
      const prev = plazaBreakers(now - 1000, crowd);
      const cur = plazaBreakers(now, crowd);
      for (const id of prev) if (breakPlace(now, 0, id) === 'plaza') { expect(cur.has(id)).toBe(true); kept++; }
    }
    expect(kept).toBeGreaterThan(0);
  });

  it('ignores bots that are not idle', () => {
    const bots = ids.map((id) => ({ id }));
    for (let now = 0; now <= 3 * 60 * MIN; now += 10_000) expect(plazaBreakers(now, bots).size).toBe(0);
  });
});
