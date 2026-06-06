import type { DailyUsage } from '../../shared/protocol';

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export function usd(n: number): string {
  if (n >= 100) return '$' + n.toFixed(0);
  if (n >= 1) return '$' + n.toFixed(2);
  if (n > 0) return '$' + n.toFixed(3);
  return '$0';
}

export function startOfDay(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function costToday(series: DailyUsage[], now: number = Date.now()): number {
  const start = startOfDay(now);
  return series.filter((d) => d.day >= start).reduce((a, d) => a + d.cost, 0);
}
