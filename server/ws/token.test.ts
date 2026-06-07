import { describe, it, expect } from 'vitest';
import { tokenFromUrl, tokenAllowed } from './token';

describe('tokenFromUrl', () => {
  it('extracts token from query', () => {
    expect(tokenFromUrl('/ws?token=abc')).toBe('abc');
    expect(tokenFromUrl('/ws?x=1&token=abc&y=2')).toBe('abc');
  });
  it('returns empty when absent', () => {
    expect(tokenFromUrl('/ws')).toBe('');
    expect(tokenFromUrl('')).toBe('');
    expect(tokenFromUrl(undefined)).toBe('');
    expect(tokenFromUrl('/ws?other=1')).toBe('');
  });
});

describe('tokenAllowed', () => {
  it('opens when no token configured (legacy loopback)', () => {
    expect(tokenAllowed('', '')).toBe(true);
    expect(tokenAllowed('', 'anything')).toBe(true);
  });
  it('requires exact match when configured', () => {
    expect(tokenAllowed('secret', 'secret')).toBe(true);
    expect(tokenAllowed('secret', 'wrong')).toBe(false);
    expect(tokenAllowed('secret', '')).toBe(false);
    expect(tokenAllowed('secret', 'secre')).toBe(false);
    expect(tokenAllowed('secret', 'secrett')).toBe(false);
  });
});
