import { describe, expect, it } from 'vitest';
import { nightFactor } from './lighting';

describe('nightFactor', () => {
  it('is day around noon and night at 2am', () => {
    expect(nightFactor(12)).toBe(0);
    expect(nightFactor(2)).toBe(1);
    expect(nightFactor(18)).toBeGreaterThan(0);
    expect(nightFactor(18)).toBeLessThan(1);
  });
});
