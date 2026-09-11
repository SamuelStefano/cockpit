import type { Cron } from '../../../shared/protocol';
import { nextRunAt } from '../../../shared/cron-schedule';

export const TIMELINE_WINDOW_MS = 24 * 60 * 60_000;
export const CLASH_MS = 15 * 60_000;
const MAX_SLOTS_PER_CRON = 48;

export interface CronSlot {
  cronId: string;
  name: string;
  at: number;
  clash: boolean;
}

function slotsFor(c: Cron, now: number, end: number): number[] {
  if (!c.enabled) return [];
  if (c.schedule.kind === 'once') {
    const at = c.schedule.atMs ?? 0;
    const pending = !c.lastRun || c.lastRun < at;
    return pending && at >= now && at < end ? [at] : [];
  }
  if (c.schedule.kind === 'daily') {
    const at = nextRunAt(c, now);
    return at < end ? [at] : [];
  }
  const every = Math.max(1, c.schedule.everyMinutes ?? 60) * 60_000;
  const out: number[] = [];
  // An overdue interval fires on the next scheduler tick, so it is drawn at "now".
  for (let at = Math.max(nextRunAt(c, now), now); at < end && out.length < MAX_SLOTS_PER_CRON; at += every) out.push(at);
  return out;
}

// Runs from different crons close together share the same plan quota window.
export function upcomingSlots(crons: Cron[], now: number, windowMs = TIMELINE_WINDOW_MS): CronSlot[] {
  const end = now + windowMs;
  const slots = crons
    .flatMap((c) => slotsFor(c, now, end).map((at) => ({ cronId: c.id, name: c.name, at, clash: false })))
    .sort((a, b) => a.at - b.at);
  for (let i = 1; i < slots.length; i++) {
    const prev = slots[i - 1];
    const cur = slots[i];
    if (cur.cronId !== prev.cronId && cur.at - prev.at < CLASH_MS) {
      prev.clash = true;
      cur.clash = true;
    }
  }
  return slots;
}
