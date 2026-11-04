import { describe, expect, it } from 'vitest';
import { pinchWheelFactor } from './input';

describe('pinchWheelFactor', () => {
  it('zooms in on negative delta, out on positive, and caps a burst', () => {
    expect(pinchWheelFactor(-5)).toBeLessThan(1);
    expect(pinchWheelFactor(5)).toBeGreaterThan(1);
    expect(pinchWheelFactor(9999)).toBe(pinchWheelFactor(30));
  });
});
