export interface MarathonRun {
  start: number;
  lastActive: number;
  turns: number;
  running: boolean;
  dismissed: boolean;
}

export const MARATHON_MIN_RUN_MS = 3600_000;
export const MARATHON_IDLE_MS = 10 * 60_000;

// Follows each marathon session across renders: when it first runs, how many turns it
// finished (a running→idle edge is one turn) and when it was last busy.
export function stepRuns(prev: Record<string, MarathonRun>, marathon: Set<string>, running: Set<string>, now: number): Record<string, MarathonRun> {
  const next: Record<string, MarathonRun> = {};
  for (const id of marathon) {
    const r = prev[id];
    if (running.has(id)) {
      next[id] = r ? { ...r, running: true, lastActive: now } : { start: now, lastActive: now, turns: 0, running: true, dismissed: false };
    } else if (r?.running) {
      next[id] = { ...r, running: false, turns: r.turns + 1, lastActive: now };
    } else if (r) {
      next[id] = r;
    }
  }
  return next;
}

// Card time: more than an hour of running, then more than 10 minutes of quiet.
export function reportReady(r: MarathonRun | undefined, now: number): boolean {
  if (!r || r.running || r.dismissed) return false;
  return r.lastActive - r.start > MARATHON_MIN_RUN_MS && now - r.lastActive > MARATHON_IDLE_MS;
}

export function fmtDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  const h = Math.floor(min / 60);
  return h ? `${h}h ${String(min % 60).padStart(2, '0')}min` : `${min}min`;
}
