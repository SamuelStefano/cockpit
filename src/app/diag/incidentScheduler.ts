// When to file a diag report. An incident is one failure state (its key); it is
// reported once it has lasted PERSIST_MS (immediate ones at once), then again
// every REPEAT_MS while it lasts — the "cron" the admin reads. Automatic reports
// share one hourly budget; the button has its own, so a busy incident never
// silences the person asking for help.
export const PERSIST_MS = 20_000;
export const REPEAT_MS = 5 * 60_000;
export const MAX_PER_HOUR = 6;
export const MAX_MANUAL_PER_HOUR = 10;
const HOUR = 3600_000;

export interface SendDecision { send: boolean; repeat: number }

export function createIncidentScheduler(limits: { persistMs?: number; repeatMs?: number; maxPerHour?: number } = {}) {
  const persistMs = limits.persistMs ?? PERSIST_MS;
  const repeatMs = limits.repeatMs ?? REPEAT_MS;
  const maxPerHour = limits.maxPerHour ?? MAX_PER_HOUR;
  let current: { key: string; since: number; lastSent: number | null; repeat: number } | null = null;
  const auto: number[] = [];
  const byHand: number[] = [];
  const seen = new Set<string>();

  const take = (log: number[], max: number, now: number): boolean => {
    while (log.length && now - log[0] >= HOUR) log.shift();
    if (log.length >= max) return false;
    log.push(now);
    return true;
  };
  const spend = (now: number) => take(auto, maxPerHour, now);

  return {
    // Call on every state change and on a timer; `key` null = no incident.
    tick(key: string | null, now: number, immediate = false): SendDecision {
      if (!key) { current = null; return { send: false, repeat: 0 }; }
      if (!current || current.key !== key) current = { key, since: now, lastSent: null, repeat: 0 };
      const due = current.lastSent === null
        ? now - current.since >= (immediate ? 0 : persistMs)
        : now - current.lastSent >= repeatMs;
      if (!due || !spend(now)) return { send: false, repeat: current.repeat };
      current.lastSent = now;
      return { send: true, repeat: current.repeat++ };
    },
    // A one-off event (a JS error): once per distinct key per page.
    once(key: string, now: number): boolean {
      if (seen.has(key)) return false;
      if (!spend(now)) return false;
      seen.add(key);
      return true;
    },
    manual(now: number): boolean { return take(byHand, MAX_MANUAL_PER_HOUR, now); },
  };
}

export type IncidentScheduler = ReturnType<typeof createIncidentScheduler>;
