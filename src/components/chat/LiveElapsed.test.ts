import { describe, it, expect } from 'vitest';
import { formatElapsed } from './LiveElapsed';

describe('formatElapsed', () => {
  it('formats seconds and minutes', () => {
    expect(formatElapsed(4_200)).toBe('4s');
    expect(formatElapsed(125_000)).toBe('2m 05s');
    expect(formatElapsed(-5)).toBe('0s');
  });
});
