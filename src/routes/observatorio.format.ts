import type { DailyUsage } from '../../shared/protocol';
import { fmtCost } from '../lib/format';

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

export const usd = fmtCost;

export function startOfDay(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function costToday(series: DailyUsage[], now: number = Date.now()): number {
  const start = startOfDay(now);
  return series.filter((d) => d.day >= start).reduce((a, d) => a + d.cost, 0);
}

export function relTime(ts: number, now: number = Date.now()): string {
  const m = Math.floor((now - ts) / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

