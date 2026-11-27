import { describe, it, expect } from 'vitest';
import { fillGaps, filterSeries } from './trend-filter';
import type { DailyUsage } from '../../../shared/protocol';

const DAY = 24 * 60 * 60 * 1000;
const now = 100 * DAY;

const day = (offset: number): DailyUsage => ({ day: now - offset * DAY, output: 0, cost: 0 });

const series = [day(40), day(20), day(10), day(3), day(0)];

describe('filterSeries', () => {
  it('all devolve a série inteira', () => {
    expect(filterSeries(series, 'all', now)).toHaveLength(5);
  });

  it('7d mantém só os últimos 7 dias', () => {
    const got = filterSeries(series, '7d', now).map((d) => (now - d.day) / DAY);
    expect(got).toEqual([3, 0]);
  });

  it('30d mantém os últimos 30 dias', () => {
    const got = filterSeries(series, '30d', now).map((d) => (now - d.day) / DAY);
    expect(got).toEqual([20, 10, 3, 0]);
  });
});

describe('fillGaps', () => {
  const D = 24 * 60 * 60 * 1000;
  it('inserts zero days between buckets so bars are real consecutive days', () => {
    const out = fillGaps([{ day: 0, output: 1, cost: 1 }, { day: 3 * D, output: 2, cost: 2 }]);
    expect(out.map((d) => d.day)).toEqual([0, D, 2 * D, 3 * D]);
    expect(out[1]).toEqual({ day: D, output: 0, cost: 0 });
  });
  it('leaves 0 or 1 bucket alone', () => {
    expect(fillGaps([])).toEqual([]);
    expect(fillGaps([{ day: 5, output: 1, cost: 1 }])).toHaveLength(1);
  });
});
