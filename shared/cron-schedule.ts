import type { Cron, CronSchedule } from './protocol';

// Matemática de agendamento dos crons — pura (recebe `now`), compartilhada entre o
// scheduler do servidor e o display da UI pra não divergirem.
const DAY = 86_400_000;
function midnight(now: number): number { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }

export function scheduleLabel(s: CronSchedule): string {
  if (s.kind === 'once') {
    const d = new Date(s.atMs ?? 0);
    const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `uma vez em ${day} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (s.kind === 'interval') {
    const m = s.everyMinutes ?? 60;
    return m % 60 === 0 ? `a cada ${m / 60}h` : `a cada ${m}min`;
  }
  const at = s.atMinute ?? 540;
  return `todo dia ${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
}

// Próxima execução (pro display da UI). Intervalo: último + N min. Diário: o slot de
// hoje se ainda não passou/não rodou, senão o de amanhã. Uma vez: o instante marcado.
export function nextRunAt(c: Cron, now: number): number {
  if (c.schedule.kind === 'once') return c.schedule.atMs ?? c.createdAt;
  if (c.schedule.kind === 'interval') {
    const every = Math.max(1, c.schedule.everyMinutes ?? 60) * 60_000;
    return (c.lastRun ?? c.createdAt) + every;
  }
  const at = Math.max(0, Math.min(1439, c.schedule.atMinute ?? 540)) * 60_000;
  const today = midnight(now) + at;
  const ranToday = !!c.lastRun && c.lastRun >= midnight(now);
  return now < today && !ranToday ? today : today + DAY;
}

// Guarda de borda: o frame de `cron-save` vem cru do cliente, então a forma do
// schedule é validada antes de persistir — um `atMs` não-numérico viraria NaN no
// agendador (nunca dispara) e "Invalid Date" no card.
export function scheduleValid(s: CronSchedule | undefined): boolean {
  if (!s) return false;
  if (s.kind === 'interval') return Number.isFinite(s.everyMinutes);
  if (s.kind === 'daily') return Number.isFinite(s.atMinute);
  if (s.kind === 'once') return Number.isFinite(s.atMs) && (s.atMs ?? 0) > 0;
  return false;
}

// Está vencido AGORA (deve disparar)?
export function isDue(c: Cron, now: number): boolean {
  if (!c.enabled) return false;
  // lastRun < atMs (em vez de "nunca rodou") pra reagendar um one-shot já disparado
  // pra uma data futura voltar a valer.
  if (c.schedule.kind === 'once') {
    const at = c.schedule.atMs ?? c.createdAt;
    return now >= at && (!c.lastRun || c.lastRun < at);
  }
  if (c.schedule.kind === 'interval') {
    const every = Math.max(1, c.schedule.everyMinutes ?? 60) * 60_000;
    return (c.lastRun ?? c.createdAt) + every <= now;
  }
  const slot = midnight(now) + Math.max(0, Math.min(1439, c.schedule.atMinute ?? 540)) * 60_000;
  return now >= slot && (!c.lastRun || c.lastRun < slot);
}
