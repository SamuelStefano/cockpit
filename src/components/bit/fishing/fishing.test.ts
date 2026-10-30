import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../../game/quests';
import { CATCHES, rollCatch, nextBiteDelay, clickAllowed, freeMargin, marginFits, BITE_MIN_MS, BITE_MAX_MS, CLICK_COOLDOWN_MS } from './fishing';

describe('fishing', () => {
  it('keeps bite delays inside 10-25 s', () => {
    const rnd = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const d = nextBiteDelay(rnd);
      expect(d).toBeGreaterThanOrEqual(BITE_MIN_MS);
      expect(d).toBeLessThanOrEqual(BITE_MAX_MS);
    }
  });

  it('is deterministic with a seeded rng and rolls every item, the star rarely', () => {
    const a = Array.from({ length: 30 }, ((r) => () => rollCatch(r).id)(mulberry32(3)));
    const b = Array.from({ length: 30 }, ((r) => () => rollCatch(r).id)(mulberry32(3)));
    expect(a).toEqual(b);
    const rnd = mulberry32(11);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) { const c = rollCatch(rnd).id; counts[c] = (counts[c] ?? 0) + 1; }
    for (const c of CATCHES) expect(counts[c.id]).toBeGreaterThan(0);
    expect(counts.star).toBeLessThan(counts.fish / 5);
  });

  it('picks the edges of the table', () => {
    expect(rollCatch(() => 0).id).toBe('fish');
    expect(rollCatch(() => 0.9999).id).toBe('star');
  });

  it('throttles clicks with a cooldown', () => {
    expect(clickAllowed(10_000, 10_000 - CLICK_COOLDOWN_MS + 1)).toBe(false);
    expect(clickAllowed(10_000, 10_000 - CLICK_COOLDOWN_MS)).toBe(true);
  });

  it('needs free margin beside the column', () => {
    expect(freeMargin(760 + 24)).toBe(12);
    expect(marginFits(900)).toBe(false);
    expect(marginFits(1100)).toBe(true);
    expect(freeMargin(500)).toBe(12);
  });
});
