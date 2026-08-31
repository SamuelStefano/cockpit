import { describe, it, expect } from 'vitest';
import { relReset } from './time';

describe('relReset', () => {
  const now = 1_000_000_000_000;

  it('returns "agora" at or past the reset', () => {
    expect(relReset(now, now)).toBe('agora');
    expect(relReset(now - 5000, now)).toBe('agora');
  });

  it('formats sub-hour as minutes', () => {
    expect(relReset(now + 42 * 60000, now)).toBe('42min');
    expect(relReset(now + 59 * 60000, now)).toBe('59min');
  });

  it('formats an hour or more as Hh MM with zero padding', () => {
    expect(relReset(now + 60 * 60000, now)).toBe('1h00');
    expect(relReset(now + (3 * 60 + 5) * 60000, now)).toBe('3h05');
    expect(relReset(now + (2 * 60 + 30) * 60000, now)).toBe('2h30');
  });

  it('rounds to the nearest minute', () => {
    expect(relReset(now + 90_000, now)).toBe('2min');
    expect(relReset(now + 89_000, now)).toBe('1min');
  });

  it('clamps tiny positive diffs to 1min instead of 0min', () => {
    expect(relReset(now + 10_000, now)).toBe('1min');
  });

  it('switches to days past 24h, for the weekly window', () => {
    expect(relReset(now + 23 * 3600_000, now)).toBe('23h00');
    expect(relReset(now + 24 * 3600_000, now)).toBe('1d0h');
    expect(relReset(now + (2 * 24 + 14) * 3600_000, now)).toBe('2d14h');
    expect(relReset(now + 167 * 3600_000, now)).toBe('6d23h');
  });
});
