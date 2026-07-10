import type { DailyUsage } from '../../../shared/protocol';

export type TrendPeriod = '7d' | '30d' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;

export function filterSeries(series: DailyUsage[], period: TrendPeriod, now: number = Date.now()): DailyUsage[] {
  if (period === 'all') return series;
  const days = period === '7d' ? 7 : 30;
  const cutoff = now - days * DAY_MS;
  return series.filter((d) => d.day >= cutoff);
}
