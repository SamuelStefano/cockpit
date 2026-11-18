import { hashId, seeded } from './world-wander';

export const BREAK_AFTER_MS = 30 * 60_000;
const JITTER_MS = 30_000;
const STROLL_MIN_MS = 20_000;
const STROLL_MAX_MS = 40_000;
const GAP_MIN_MS = 10 * 60_000;
const GAP_MAX_MS = 20 * 60_000;
const MAX_STROLLS = 400;

const span = (id: string, k: number, salt: number, min: number, max: number): number => Math.round(min + seeded(hashId(id, k * 31 + salt))() * (max - min));

// Where an idle bot is at `now`: at its desk, or on the plaza during a short stroll.
// The first stroll starts 30 min after the bot went idle; the next ones follow every
// 10-20 min. Everything is seeded by the bot id, so every client agrees.
export function breakPlace(now: number, idleSince: number | undefined, id: string): 'desk' | 'plaza' {
  if (idleSince === undefined || !Number.isFinite(idleSince)) return 'desk';
  const t = now - idleSince;
  if (t < BREAK_AFTER_MS) return 'desk';
  let start = BREAK_AFTER_MS + span(id, 0, 1, 0, JITTER_MS);
  for (let k = 0; k < MAX_STROLLS && start <= t; k++) {
    const end = start + span(id, k, 2, STROLL_MIN_MS, STROLL_MAX_MS);
    if (t < end) return 'plaza';
    start = end + span(id, k, 3, GAP_MIN_MS, GAP_MAX_MS);
  }
  return 'desk';
}
