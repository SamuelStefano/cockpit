import { describe, it, expect } from 'vitest';
import { isAdminOnly, takeToken, createRateLimiter, type Bucket } from './guard';

describe('isAdminOnly', () => {
  it('gates terminal and admin messages', () => {
    for (const t of ['admin-health', 'term-open', 'term-input', 'term-resize', 'term-detach', 'term-close', 'term-list'] as const) {
      expect(isAdminOnly(t)).toBe(true);
    }
  });
  it('leaves normal chat messages open', () => {
    for (const t of ['send', 'stop', 'list', 'open', 'search', 'upload', 'usage-list'] as const) {
      expect(isAdminOnly(t)).toBe(false);
    }
  });
});

describe('takeToken', () => {
  it('consumes one token per call until empty', () => {
    const b: Bucket = { tokens: 2, last: 0 };
    expect(takeToken(b, 0, 1, 5)).toBe(true);
    expect(takeToken(b, 0, 1, 5)).toBe(true);
    expect(takeToken(b, 0, 1, 5)).toBe(false);
  });
  it('refills over elapsed time up to burst', () => {
    const b: Bucket = { tokens: 0, last: 0 };
    expect(takeToken(b, 1000, 1, 5)).toBe(true); // 1s → +1 token, spend it
    expect(takeToken(b, 1000, 1, 5)).toBe(false);
    expect(takeToken(b, 11000, 1, 5)).toBe(true); // 10s later → capped at burst 5
    expect(b.tokens).toBeCloseTo(4); // 5 refilled, 1 spent
  });
  it('never exceeds burst on long idle', () => {
    const b: Bucket = { tokens: 5, last: 0 };
    takeToken(b, 1_000_000, 10, 5);
    expect(b.tokens).toBeLessThanOrEqual(5);
  });
  it('treats clock going backwards as zero elapsed', () => {
    const b: Bucket = { tokens: 1, last: 1000 };
    expect(takeToken(b, 500, 10, 5)).toBe(true);
    expect(takeToken(b, 500, 10, 5)).toBe(false);
  });
});

describe('createRateLimiter', () => {
  it('allows normal traffic within budget', () => {
    let now = 0;
    const lim = createRateLimiter(() => now);
    for (let i = 0; i < 10; i++) expect(lim.allow('list')).toBe(true);
  });
  it('throttles a burst of heavy ops sooner than light ops', () => {
    let now = 0;
    const lim = createRateLimiter(() => now);
    let heavyAllowed = 0;
    for (let i = 0; i < 30; i++) if (lim.allow('search')) heavyAllowed++;
    expect(heavyAllowed).toBeLessThanOrEqual(15); // heavy burst cap
  });
  it('cuts off a runaway global loop', () => {
    let now = 0;
    const lim = createRateLimiter(() => now);
    let allowed = 0;
    for (let i = 0; i < 1000; i++) if (lim.allow('stop')) allowed++;
    expect(allowed).toBeLessThanOrEqual(120); // global burst cap
  });
  it('recovers after time passes', () => {
    let now = 0;
    const lim = createRateLimiter(() => now);
    for (let i = 0; i < 200; i++) lim.allow('stop'); // drain
    now = 5000; // 5s later
    expect(lim.allow('stop')).toBe(true);
  });
});
