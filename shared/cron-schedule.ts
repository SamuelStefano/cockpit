import type { Cron, CronSchedule } from './protocol';

// Matemática de agendamento dos crons — pura (recebe `now`), compartilhada entre o
// scheduler do servidor e o display da UI pra não divergirem.
const DAY = 86_400_000;
function midnight(now: number): number { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }

export function scheduleLabel(s: CronSchedule): string {
  if (s.kind === 'interval') {
    const m = s.everyMinutes ?? 60;
    return m % 60 === 0 ? `a cada ${m / 60}h` : `a cada ${m}min`;
  }
  const at = s.atMinute ?? 540;
  return `todo dia ${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
}

// Próxima execução (pro display da UI). Intervalo: último + N min. Diário: o slot de
// hoje se ainda não passou/não rodou, senão o de amanhã.
export function nextRunAt(c: Cron, now: number): number {
  if (c.schedule.kind === 'interval') {
    const every = Math.max(1, c.schedule.everyMinutes ?? 60) * 60_000;
    return (c.lastRun ?? c.createdAt) + every;
  }
  const at = Math.max(0, Math.min(1439, c.schedule.atMinute ?? 540)) * 60_000;
  const today = midnight(now) + at;
  const ranToday = !!c.lastRun && c.lastRun >= midnight(now);
  return now < today && !ranToday ? today : today + DAY;
}

// Está vencido AGORA (deve disparar)?
export function isDue(c: Cron, now: number): boolean {
  if (!c.enabled) return false;
  if (c.schedule.kind === 'interval') {
    const every = Math.max(1, c.schedule.everyMinutes ?? 60) * 60_000;
    return (c.lastRun ?? c.createdAt) + every <= now;
  }
  const slot = midnight(now) + Math.max(0, Math.min(1439, c.schedule.atMinute ?? 540)) * 60_000;
  return now >= slot && (!c.lastRun || c.lastRun < slot);
}
