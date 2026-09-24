import { describe, it, expect } from 'vitest';
import { fmtIn } from './CronCard';

describe('fmtIn', () => {
  const H = 3_600_000;
  it('does not round 36h up to "em 2d"', () => {
    expect(fmtIn(36 * H, 0)).toBe('em 1d 12h');
    expect(fmtIn(48 * H, 0)).toBe('em 2d');
  });
});
