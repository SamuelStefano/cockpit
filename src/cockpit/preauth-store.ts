import { ENROLL_TTL_MS } from '../../shared/e2e/enroll';
import { fromB64, toB64, type Bytes } from '../../shared/e2e/bytes';

// Device-code secrets from the setup commands this tab showed, one per pair
// code. They live in sessionStorage (this tab only, gone when it closes) and no
// longer than the box keeps them (10 min from `--pair`): after the command runs
// the user comes back to this same tab, which is all the pre-authorization needs.

const KEY = 'deck-e2e-preauth';
type Entries = Record<string, { secret: string; expiresAt: number }>;

let memory: Entries = {};

function read(): Entries {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Entries) : {};
  } catch { return memory; }
}

function write(e: Entries): void {
  memory = e;
  try {
    if (Object.keys(e).length) sessionStorage.setItem(KEY, JSON.stringify(e));
    else sessionStorage.removeItem(KEY);
  } catch { /* storage blocked: the in-memory copy still serves this page */ }
}

function live(now: number): Entries {
  return Object.fromEntries(Object.entries(read()).filter(([, v]) => typeof v?.secret === 'string' && v.expiresAt > now));
}

export function savePreauth(pairCode: string, secret: Bytes, now = Date.now()): void {
  write({ ...live(now), [pairCode]: { secret: toB64(secret), expiresAt: now + ENROLL_TTL_MS } });
}

// Newest first: the last command shown is the likeliest to have run.
export function pendingPreauths(now = Date.now()): Bytes[] {
  return Object.values(live(now)).sort((a, b) => b.expiresAt - a.expiresAt).map((v) => fromB64(v.secret));
}

export function dropPreauth(secret: Bytes, now = Date.now()): void {
  const s = toB64(secret);
  write(Object.fromEntries(Object.entries(live(now)).filter(([, v]) => v.secret !== s)));
}
