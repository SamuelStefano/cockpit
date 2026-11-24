import { describe, expect, it } from 'vitest';
import { planPath, Stroller } from './stroll';

const seq = (v = 0.3) => () => v;
const ctx = (over = {}) => ({ worldX: 0, worldZ: -2.5, may: true, restless: true, ...over });

describe('planPath', () => {
  it('leaves through the aisle, clear of the desk footprint', () => {
    for (const worldZ of [-2.5, -9.5]) {
      const p = planPath(0, worldZ, seq(), 18);
      expect(p[1].x).toBe(0);
      expect(Math.abs(p[2].x)).toBeGreaterThan(2.7);
      expect(p[3].x).toBe(p[2].x);
      expect(p[4].z + worldZ).toBeGreaterThanOrEqual(3);
    }
  });
  it('turns back from the floor edge', () => {
    expect(planPath(55, -2.5, seq(), 18)[2].x).toBeLessThan(0);
    expect(planPath(-55, -2.5, seq(), 18)[2].x).toBeGreaterThan(0);
  });
});

describe('Stroller', () => {
  const run = (s: Stroller, sec: number, c = ctx()) => { let f = s.update(0, c); for (let i = 0; i < sec * 20; i++) f = s.update(0.05, c); return f; };
  it('stays seated while not allowed to roam', () => {
    expect(run(new Stroller(seq()), 60, ctx({ may: false })).phase).toBe('seated');
  });
  it('roams, pauses with a pose and comes back to the chair', () => {
    const s = new Stroller(seq()), seen = new Set<string>();
    for (let i = 0; i < 1200; i++) seen.add(s.update(0.05, ctx()).phase);
    expect([...seen].sort()).toEqual(['back', 'out', 'pause', 'seated']);
  });
  it('runs back as soon as it is needed and ends in the chair', () => {
    const s = new Stroller(seq());
    run(s, 8);
    const f = run(s, 12, ctx({ may: false }));
    expect(f).toMatchObject({ phase: 'seated', x: 0, z: 1.75, pose: null });
  });
});
