import { describe, it, expect } from 'vitest';
import { filterSeries } from './trend-filter';
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
