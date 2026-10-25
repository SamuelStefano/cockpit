import { describe, it, expect } from 'vitest';
import { pickGrokToken } from './grok-auth';

const NOW = Date.parse('2026-10-25T12:00:00Z');

describe('pickGrokToken', () => {
  it('reads the bearer of the account entry', () => {
    expect(pickGrokToken({ 'https://auth.x.ai::u1': { key: 'k1', expires_at: '2026-10-26T00:00:00Z' } }, NOW)).toBe('k1');
  });

  it('skips expired entries and prefers the one that lasts longer', () => {
    const raw = {
      a: { key: 'old', expires_at: '2026-10-24T00:00:00Z' },
      b: { key: 'soon', expires_at: '2026-10-25T13:00:00Z' },
      c: { key: 'later', expires_at: '2026-10-30T00:00:00Z' },
    };
    expect(pickGrokToken(raw, NOW)).toBe('later');
  });

  it('accepts an entry without a readable expiry (the endpoint decides)', () => {
    expect(pickGrokToken({ a: { key: 'k' } }, NOW)).toBe('k');
  });

  it('returns null for a missing, malformed or all-expired file', () => {
    expect(pickGrokToken(null, NOW)).toBeNull();
    expect(pickGrokToken('x', NOW)).toBeNull();
    expect(pickGrokToken({ a: { key: '' } }, NOW)).toBeNull();
    expect(pickGrokToken({ a: { key: 'k', expires_at: '2026-01-01T00:00:00Z' } }, NOW)).toBeNull();
  });
});
