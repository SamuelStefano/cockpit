const KEY = 'deck-base-seen';
export const SEEN_CAP = 200;

export type SeenMap = Record<string, number>;

// Storage can throw (private mode, quota), so every access is guarded.
const read = (): unknown => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
const write = (v: SeenMap) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

export function readSeen(): SeenMap {
  const raw = read();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SeenMap = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  return out;
}

// Only ever moves a session's mark forward; past the cap the entries with the oldest mark go first.
export function withSeen(map: SeenMap, sessionId: string, ts: number, cap = SEEN_CAP): SeenMap {
  const next: SeenMap = { ...map, [sessionId]: Math.max(ts, map[sessionId] ?? ts) };
  const keys = Object.keys(next);
  if (keys.length <= cap) return next;
  const drop = keys.filter((k) => k !== sessionId).sort((a, b) => next[a] - next[b]).slice(0, keys.length - cap);
  for (const k of drop) delete next[k];
  return next;
}

export function markSeen(sessionId: string, ts: number): void {
  write(withSeen(readSeen(), sessionId, ts));
}

// Never marks a row without a timestamp, or anything in a session that has no mark yet.
export function isNewSince(seen: number | undefined, ts: number | undefined): boolean {
  return seen !== undefined && ts !== undefined && ts > seen;
}
