import { describe, expect, it } from 'vitest';
import { cpuHeat, ctxPct, fmtMb, fmtTokens, shortModel } from './term-stats-view';

describe('ctxPct', () => {
  it('uses the 200k window for a small session', () => {
    expect(ctxPct({ contextTokens: 100_000, model: 'claude-opus-5-5' })).toBe(50);
  });
  it('infers the 1M window once past 200k, since the transcript drops the [1m] tag', () => {
    expect(ctxPct({ contextTokens: 351_450, model: 'claude-opus-5-5' })).toBe(35);
  });
  it('is null without a turn yet', () => {
    expect(ctxPct({})).toBeNull();
  });
});

describe('formatters', () => {
  it('prints compact sizes', () => {
    expect(fmtTokens(351_450)).toBe('351k');
    expect(fmtTokens(1_200_000)).toBe('1.2M');
    expect(fmtMb(676)).toBe('676MB');
    expect(fmtMb(2048)).toBe('2.0GB');
    expect(shortModel('claude-haiku-4-5-20251001')).toBe('haiku-4-5');
  });
  it('grades cpu', () => {
    expect([cpuHeat(5), cpuHeat(40), cpuHeat(120)]).toEqual(['ok', 'warn', 'hot']);
  });
});
