import { describe, it, expect } from 'vitest';
import { MAX_PARTICLES, ParticleSim, jumpLift, stepPhase, walkBob } from './world-juice';

describe('walkBob', () => {
  it('stays small and squashes on landing', () => {
    expect(walkBob(0)).toMatchObject({ lift: 0 });
    expect(walkBob(0).sy).toBeLessThan(1);
    const peak = walkBob(Math.PI / 2);
    expect(peak.lift).toBeLessThanOrEqual(2);
    expect(peak.sy).toBeGreaterThan(1);
    for (let p = 0; p < 20; p += 0.3) expect(walkBob(p).sy).toBeGreaterThan(0.9);
  });
  it('steps once per 8px', () => {
    expect(stepPhase(8)).toBeCloseTo(Math.PI);
  });
});

describe('jumpLift', () => {
  it('is zero outside the jump and hops twice inside', () => {
    expect(jumpLift(0)).toBe(0);
    expect(jumpLift(1)).toBe(0);
    expect(jumpLift(0.25)).toBeCloseTo(9);
    expect(jumpLift(0.75)).toBeCloseTo(9);
    expect(jumpLift(0.5)).toBeCloseTo(0);
  });
});

describe('ParticleSim', () => {
  it('never exceeds the cap', () => {
    const s = new ParticleSim();
    for (let i = 0; i < 200; i++) s.spawn('dust', i, 0, 0, 0, 1000);
    expect(s.live).toBe(MAX_PARTICLES);
    expect(s.particles.length).toBe(MAX_PARTICLES);
  });
  it('recycles the oldest first', () => {
    const s = new ParticleSim(2);
    s.spawn('dust', 1, 0, 0, 0, 1000);
    s.step(500);
    s.spawn('dust', 2, 0, 0, 0, 1000);
    s.spawn('spark', 3, 0, 0, 0, 1000);
    expect(s.particles.map((p) => p.x).sort()).toEqual([2, 3]);
  });
  it('expires and moves', () => {
    const s = new ParticleSim(3);
    const p = s.spawn('dust', 0, 0, 10, 0, 100);
    s.step(50);
    expect(p.x).toBeCloseTo(0.5);
    s.step(60);
    expect(s.live).toBe(0);
  });
});
