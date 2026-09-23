import { describe, it, expect } from 'vitest';
import { clampToRange, nextPlayT } from './useTimeline';

describe('clampToRange', () => {
  it('passes a value already inside the range through', () => {
    expect(clampToRange(50, 0, 100)).toBe(50);
  });
  it('clamps below start and above end', () => {
    expect(clampToRange(-10, 0, 100)).toBe(0);
    expect(clampToRange(200, 0, 100)).toBe(100);
  });
});

describe('nextPlayT', () => {
  it('advances by the step while below the end', () => {
    const r = nextPlayT(0, 1_000_000);
    expect(r.done).toBe(false);
    expect(r.t).toBeGreaterThan(0);
  });
  it('clamps to end and reports done once the step would overshoot it', () => {
    const end = 1000;
    const r = nextPlayT(end - 1, end);
    expect(r).toEqual({ t: end, done: true });
  });
});
