import { describe, expect, it } from 'vitest';
import { createBudget } from './budget.ts';

const H = 3_600_000;

describe('createBudget', () => {
  it('allows 6 per hour then refuses and counts the overflow', () => {
    let t = 0;
    const b = createBudget(() => t);
    for (let i = 0; i < 6; i++) expect(b.take()).toBe(true);
    expect(b.take()).toBe(false);
    expect(b.suppressed()).toBe(1);
    t += H;
    expect(b.take()).toBe(true);
  });

  it('caps at 12 per day even when the hourly window is free', () => {
    let t = 0;
    const b = createBudget(() => t);
    for (let i = 0; i < 12; i++) { expect(b.take()).toBe(true); t += 2 * H; if (i === 5) t += 0; }
    expect(b.take()).toBe(true);
  });

  it('refuses the 13th message inside 24 h', () => {
    let t = 0;
    const b = createBudget(() => t);
    for (let i = 0; i < 12; i++) { expect(b.take()).toBe(true); t += 1.5 * H; }
    expect(t).toBeLessThan(24 * H);
    expect(b.take()).toBe(false);
  });
});
