import type { DailyUsage } from '../../../shared/protocol';

export type TrendPeriod = '7d' | '30d' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;

export function filterSeries(series: DailyUsage[], period: TrendPeriod, now: number = Date.now()): DailyUsage[] {
  if (period === 'all') return series;
  const days = period === '7d' ? 7 : 30;
  const cutoff = now - days * DAY_MS;
  return series.filter((d) => d.day >= cutoff);
}

// Days with no usage have no bucket, so the bars read as consecutive days when
// they weren't. Insert zero days between the first and last bucket. Buckets are
// Brasília midnights and BRT has no DST, so days are exactly DAY_MS apart.
export function fillGaps(series: DailyUsage[]): DailyUsage[] {
  if (series.length < 2) return series;
  const byDay = new Map(series.map((d) => [d.day, d]));
  const out: DailyUsage[] = [];
  for (let day = series[0].day; day <= series[series.length - 1].day; day += DAY_MS) {
    out.push(byDay.get(day) ?? { day, output: 0, cost: 0 });
  }
  return out;
}
