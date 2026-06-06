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
});
