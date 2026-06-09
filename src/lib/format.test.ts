import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONTEXT_LIMIT, ctxPct, fmtCost, fmtReset } from './format';

describe('ctxPct', () => {
  it('is zero at zero tokens', () => {
    expect(ctxPct(0)).toBe(0);
  });
  it('rounds the fraction of the limit', () => {
    expect(ctxPct(CONTEXT_LIMIT / 2)).toBe(50);
    expect(ctxPct(CONTEXT_LIMIT / 4)).toBe(25);
  });
  it('saturates at 100 past the limit', () => {
    expect(ctxPct(CONTEXT_LIMIT)).toBe(100);
    expect(ctxPct(CONTEXT_LIMIT * 3)).toBe(100);
  });
});

describe('fmtCost', () => {
  it('returns "$0" at or below zero', () => {
    expect(fmtCost(0)).toBe('$0');
    expect(fmtCost(-5)).toBe('$0');
  });
  it('uses three decimals under a dollar', () => {
    expect(fmtCost(0.001)).toBe('$0.001');
    expect(fmtCost(0.5)).toBe('$0.500');
  });
  it('uses two decimals from one dollar', () => {
    expect(fmtCost(1)).toBe('$1.00');
    expect(fmtCost(42.5)).toBe('$42.50');
  });
  it('drops decimals from one hundred dollars', () => {
    expect(fmtCost(100)).toBe('$100');
    expect(fmtCost(1234.6)).toBe('$1235');
  });
});

describe('fmtReset', () => {
  afterEach(() => vi.useRealTimers());
  const at = (now: number) => { vi.useFakeTimers(); vi.setSystemTime(now); };

  it('is empty for null or zero', () => {
    expect(fmtReset(null)).toBe('');
    expect(fmtReset(0)).toBe('');
  });
  it('says "em instantes" when already past', () => {
    at(10_000);
    expect(fmtReset(5_000)).toBe('em instantes');
  });
  it('formats sub-hour windows in minutes', () => {
    at(0);
    expect(fmtReset(30 * 60_000)).toBe('em 30min');
  });
  it('formats hours, dropping zero minutes', () => {
    at(0);
    expect(fmtReset(2 * 60 * 60_000)).toBe('em 2h');
    expect(fmtReset((2 * 60 + 15) * 60_000)).toBe('em 2h15min');
  });
});
