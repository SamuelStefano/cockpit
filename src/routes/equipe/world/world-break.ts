import { hashId, seeded } from './world-wander';

export const BREAK_AFTER_MS = 30 * 60_000;
const JITTER_MS = 10 * 60_000;
const PLAZA_CAP = 4;
const STROLL_MIN_MS = 20_000;
const STROLL_MAX_MS = 40_000;
const GAP_MIN_MS = 10 * 60_000;
const GAP_MAX_MS = 20 * 60_000;
const MAX_STROLLS = 400;

const span = (id: string, k: number, salt: number, min: number, max: number): number => Math.round(min + seeded(hashId(id, k * 31 + salt))() * (max - min));

export interface Stroll { place: 'desk' | 'plaza'; start?: number }

export function strollAt(now: number, idleSince: number | undefined, id: string): Stroll {
  if (idleSince === undefined || !Number.isFinite(idleSince)) return { place: 'desk' };
  const t = now - idleSince;
  if (t < BREAK_AFTER_MS) return { place: 'desk' };
  let start = BREAK_AFTER_MS + span(id, 0, 1, 0, JITTER_MS);
  for (let k = 0; k < MAX_STROLLS && start <= t; k++) {
    const end = start + span(id, k, 2, STROLL_MIN_MS, STROLL_MAX_MS);
    if (t < end) return { place: 'plaza', start: idleSince + start };
    start = end + span(id, k, 3, GAP_MIN_MS, GAP_MAX_MS);
  }
  return { place: 'desk' };
}

export const FIRST_JITTER_MS = JITTER_MS;

export function firstStrollStart(idleSince: number, id: string): number {
  return idleSince + BREAK_AFTER_MS + span(id, 0, 1, 0, JITTER_MS);
}

// Where an idle bot is at `now`: at its desk, or on the plaza during a short stroll.
// The first stroll starts 30-40 min after the bot went idle; the next ones follow every
// 10-20 min. Everything is seeded by the bot id, so every client agrees.
export function breakPlace(now: number, idleSince: number | undefined, id: string): 'desk' | 'plaza' {
  return strollAt(now, idleSince, id).place;
}

export function plazaBreakers(now: number, bots: { id: string; idleSince?: number }[], cap = PLAZA_CAP): Set<string> {
  const out: { id: string; start: number }[] = [];
  for (const b of bots) {
    const s = strollAt(now, b.idleSince, b.id);
    if (s.place === 'plaza') out.push({ id: b.id, start: s.start! });
  }
  out.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return new Set(out.slice(0, cap).map((x) => x.id));
}
