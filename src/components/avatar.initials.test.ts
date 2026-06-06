import { describe, it, expect } from 'vitest';
import { initials } from './avatar.initials';

describe('initials', () => {
  it('returns "" for blank names', () => {
    expect(initials('')).toBe('');
    expect(initials('   ')).toBe('');
  });

  it('uses the single initial for a one-word name', () => {
    expect(initials('samuel')).toBe('S');
  });

  it('uses first + last initials for multi-word names', () => {
    expect(initials('Samuel Stefano')).toBe('SS');
    expect(initials('Ana Maria Souza')).toBe('AS');
  });

  it('collapses extra whitespace', () => {
    expect(initials('  Samuel   Stefano  ')).toBe('SS');
  });
});
