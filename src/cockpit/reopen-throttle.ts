// A session open in the browser while it runs elsewhere (the Orchestrator in
// tmux, a turn started by deckctl in the other backend) gets a session-touched
// about every 1.5 s. Each one re-parsed the whole transcript on the server and
// shipped the full history back (≈400 KB for the Orchestrator, MBs for big
// sessions). One reopen per window per session is enough to follow along.
export const REOPEN_THROTTLE_MS = 5000;

export function createReopenThrottle(fire: (id: string) => void, ms = REOPEN_THROTTLE_MS) {
  const last = new Map<string, number>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const touch = (id: string) => {
    if (timers.has(id)) return;
    const since = Date.now() - (last.get(id) ?? -Infinity);
    if (since >= ms) { last.set(id, Date.now()); fire(id); return; }
    // Trailing: the last write of a burst must still be fetched.
    timers.set(id, setTimeout(() => { timers.delete(id); last.set(id, Date.now()); fire(id); }, ms - since));
  };
  const cancel = () => { for (const t of timers.values()) clearTimeout(t); timers.clear(); };
  return { touch, cancel };
}
