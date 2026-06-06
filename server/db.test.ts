import { describe, it, expect } from 'vitest';
import { priceOf, costOf } from './db';

describe('priceOf', () => {
  it('matches each tier by substring of the model name', () => {
    expect(priceOf('claude-opus-4').input).toBe(15);
    expect(priceOf('claude-3-5-haiku').input).toBe(0.8);
    expect(priceOf('claude-sonnet-4').input).toBe(3);
  });

  it('is case-insensitive', () => {
    expect(priceOf('CLAUDE-OPUS-4').output).toBe(75);
  });

  it('falls back to sonnet for null or unknown models', () => {
    expect(priceOf(null)).toEqual(priceOf('claude-sonnet-4'));
    expect(priceOf('gpt-4o')).toEqual(priceOf('claude-sonnet-4'));
  });
});

describe('costOf', () => {
  const empty = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };

  it('prices 1M input opus tokens at $15', () => {
    expect(costOf('claude-opus-4', { ...empty, input: 1_000_000 })).toBe(15);
  });

  it('prices the cheap cache-read leg separately (1M opus = $1.50)', () => {
    expect(costOf('claude-opus-4', { ...empty, cacheRead: 1_000_000 })).toBeCloseTo(1.5, 10);
  });

  it('sums all four legs', () => {
    const cost = costOf('claude-opus-4', {
      input: 1_000_000,
      output: 1_000_000,
      cacheRead: 1_000_000,
      cacheCreation: 1_000_000,
    });
    expect(cost).toBeCloseTo(15 + 75 + 1.5 + 18.75, 10);
  });

  it('returns zero for no tokens', () => {
    expect(costOf('claude-opus-4', empty)).toBe(0);
  });
});
