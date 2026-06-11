import { describe, it, expect } from 'vitest';
import { fmtNum, usd, startOfDay, costToday, relTime } from './observatorio.format';
import type { DailyUsage } from '../../shared/protocol';

describe('fmtNum', () => {
  it('passes through values under 1k', () => {
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(999)).toBe('999');
  });
  it('abbreviates thousands and millions with one decimal', () => {
    expect(fmtNum(1_500)).toBe('1.5k');
    expect(fmtNum(2_300_000)).toBe('2.3M');
  });
});

describe('usd', () => {
  it('drops decimals at $100+', () => expect(usd(150)).toBe('$150'));
  it('uses 2 decimals from $1', () => expect(usd(4.2)).toBe('$4.20'));
  it('uses 3 decimals below $1', () => expect(usd(0.025)).toBe('$0.025'));
  it('returns $0 for zero', () => expect(usd(0)).toBe('$0'));
});

describe('costToday', () => {
  const now = new Date(2026, 5, 6, 14, 30).getTime(); // 6 Jun 2026, mid-afternoon
  const series: DailyUsage[] = [
    { day: startOfDay(now) - 86_400_000, cost: 1, output: 0, samples: 0 } as DailyUsage,
    { day: startOfDay(now), cost: 2, output: 0, samples: 0 } as DailyUsage,
    { day: startOfDay(now) + 3_600_000, cost: 0.5, output: 0, samples: 0 } as DailyUsage,
  ];

  it('sums only entries at or after the start of today', () => {
    expect(costToday(series, now)).toBe(2.5);
  });

  it('returns 0 with no series', () => {
    expect(costToday([], now)).toBe(0);
  });
});

describe('relTime', () => {
  const now = 1_000_000_000_000;
  it('shows agora under a minute', () => expect(relTime(now - 30_000, now)).toBe('agora'));
  it('shows minutes under an hour', () => expect(relTime(now - 5 * 60_000, now)).toBe('5min'));
  it('shows hours under a day', () => expect(relTime(now - 3 * 3_600_000, now)).toBe('3h'));
  it('shows days past a day', () => expect(relTime(now - 2 * 86_400_000, now)).toBe('2d'));
});
