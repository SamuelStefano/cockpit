import type { Cron, CronSchedule } from './protocol';

// Matemática de agendamento dos crons — pura (recebe `now`), compartilhada entre o
// scheduler do servidor e o display da UI pra não divergirem.
const DAY = 86_400_000;

// Daily crons are anchored to Brasília (UTC-3, no DST since 2019), not the host
// timezone: the backend runs in UTC, so its local midnight made a "07:00" cron fire
// at 04:00 BRT while the UI promised 07:00.
export const CRON_TZ = 'America/Sao_Paulo';
export const CRON_TZ_OFFSET_MIN = -180;
const OFFSET_MS = CRON_TZ_OFFSET_MIN * 60_000;

export function midnightInTz(now: number): number {
  return Math.floor((now + OFFSET_MS) / DAY) * DAY - OFFSET_MS;
}

// The card, the timeline and the form preview all read Brasília, so the one-shot label
// does too — on a UTC host (the VPS) the old host-local label was three hours off.
const onceLabel = (atMs: number) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: CRON_TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(atMs).replace(',', '');

export function scheduleLabel(s: CronSchedule): string {
  if (s.kind === 'once') return `uma vez em ${onceLabel(s.atMs ?? 0)}`;
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
  const today = midnightInTz(now) + at;
  const ranToday = !!c.lastRun && c.lastRun >= midnightInTz(now);
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
  const slot = midnightInTz(now) + Math.max(0, Math.min(1439, c.schedule.atMinute ?? 540)) * 60_000;
  // A slot older than the cron itself never belonged to it: creating a 01:00 cron at
  // 23:30 used to fire an autonomous turn within the next tick, while the form preview
  // promised the slot of the following day.
  const born = Number.isFinite(c.createdAt) ? c.createdAt : 0;
  return now >= slot && slot >= born && (!c.lastRun || c.lastRun < slot);
}
