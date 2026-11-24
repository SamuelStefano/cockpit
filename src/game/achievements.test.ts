import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, TRACKED_ROUTES } from './achievements';
import { emptyState } from './engine';
import { EGG_IDS } from './eggs';

const ctx = (hour: number, extra = {}) => ({ event: { type: 'turn_done' as const, ...extra }, now: new Date(2026, 9, 30, hour, 0) });
const find = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

describe('achievements table', () => {
  it('has unique ids and enough entries', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(24);
  });
  it('covers every easter egg with a hidden achievement', () => {
    for (const e of EGG_IDS) expect(find(`egg-${e}`).hidden).toBe(true);
  });
  it('night owl only between 0h and 5h', () => {
    expect(find('night-owl').test(emptyState(), ctx(2))).toBe(true);
    expect(find('night-owl').test(emptyState(), ctx(5))).toBe(false);
    expect(find('early-bird').test(emptyState(), ctx(6))).toBe(true);
  });
  it('multitasker needs 3 concurrent', () => {
    expect(find('multitasker').test(emptyState(), ctx(12, { concurrent: 2 }))).toBe(false);
    expect(find('multitasker').test(emptyState(), ctx(12, { concurrent: 3 }))).toBe(true);
  });
  it('explorer needs every tracked route', () => {
    const s = emptyState();
    expect(find('explorer').test(s, ctx(12))).toBe(false);
    s.routes = [...TRACKED_ROUTES];
    expect(find('explorer').test(s, ctx(12))).toBe(true);
  });
});
