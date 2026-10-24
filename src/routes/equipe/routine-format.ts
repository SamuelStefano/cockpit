import type { Cron, CronSchedule } from '../../../shared/protocol';
import { nextRunAt } from '../../../shared/cron-schedule';
import { fmtIn } from '../crons/CronCard';

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function routineScheduleLabel(s: CronSchedule): string {
  if (s.kind === 'interval') {
    const m = s.everyMinutes ?? 60;
    return m % 60 === 0 ? `a cada ${m / 60} h` : `a cada ${m} min`;
  }
  if (s.kind === 'daily') return `todo dia às ${hhmm(s.atMinute ?? 540)}`;
  return 'uma vez';
}

export function routineStatusLabel(c: Cron, now: number, botGone = false): string {
  if (botGone) return 'bot removido';
  if (!c.enabled) return 'pausada';
  return `próxima ${fmtIn(nextRunAt(c, now), now)}`;
}
