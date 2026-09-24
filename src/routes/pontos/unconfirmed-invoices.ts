// Invoices whose create call got no answer in time: they may exist in DFL. The
// modal's own `created` set dies with it, so reopening would re-send them with one
// click. They are held here (per browser) until the user says they checked DFL,
// or until the next DFL sync has had time to show them.
const KEY = 'deck:pontos:unconfirmedInvoices';
export const UNCONFIRMED_TTL_MS = 30 * 60_000;

function read(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return v && typeof v === 'object' ? v as Record<string, number> : {};
  } catch { return {}; }
}

function write(map: Record<string, number>): void {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* private mode */ }
}

export function unconfirmedKeys(now: number): Set<string> {
  const map = read();
  const live = Object.entries(map).filter(([, at]) => typeof at === 'number' && now - at < UNCONFIRMED_TTL_MS);
  if (live.length !== Object.keys(map).length) write(Object.fromEntries(live));
  return new Set(live.map(([k]) => k));
}

export function markUnconfirmed(keys: string[], now: number): void {
  if (!keys.length) return;
  const map = read();
  for (const k of keys) map[k] = now;
  write(map);
}

export function releaseUnconfirmed(key: string): void {
  const map = read();
  delete map[key];
  write(map);
}
