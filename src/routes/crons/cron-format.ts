import { CRON_TZ } from '../../../shared/cron-schedule';

const dayKey = (ts: number) => new Intl.DateTimeFormat('en-CA', { timeZone: CRON_TZ }).format(ts);
const hhmm = (ts: number) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: CRON_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ts);
const ddmm = (ts: number) => new Intl.DateTimeFormat('pt-BR', { timeZone: CRON_TZ, day: '2-digit', month: '2-digit' }).format(ts);

// Cron times are shown in Brasília, the timezone the schedule runs in, whatever the
// browser's own timezone is.
export function fmtClock(ts: number, now: number): string {
  return dayKey(ts) === dayKey(now) ? `hoje ${hhmm(ts)}` : `${ddmm(ts)} ${hhmm(ts)}`;
}

export function fmtLast(ts?: number): string {
  if (!ts) return 'nunca rodou';
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: CRON_TZ }).format(ts);
  return `último: ${date} ${hhmm(ts)}`;
}
