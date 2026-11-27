import { describe, expect, it } from 'vitest';
import { revealedCount } from './typewriter';

describe('revealedCount', () => {
  it('advances by cps and never passes the total', () => {
    expect(revealedCount(100, 0, 1000, 45)).toBe(45);
    expect(revealedCount(100, 90, 1000, 45)).toBe(100);
  });
  it('does not move when the text is empty', () => {
    expect(revealedCount(0, 0, 500)).toBe(0);
  });
});
