import type { DailyUsage } from '../../shared/protocol';
import { midnightInTz } from '../../shared/cron-schedule';

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

// Os buckets do servidor são dias de Brasília; o "hoje" do cliente tem que ser o
// mesmo dia, senão o navegador em BRT comparava com a meia-noite UTC e nada batia.
export function startOfDay(now: number): number {
  return midnightInTz(now);
}

export function costToday(series: DailyUsage[], now: number = Date.now()): number {
  const start = startOfDay(now);
  return series.filter((d) => d.day >= start).reduce((a, d) => a + d.cost, 0);
}

