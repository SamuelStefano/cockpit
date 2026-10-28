import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Privacy-safe observability. Ids are only ever logged as hid(x); payloads, tokens,
// emails, IPs and user agents never reach an event.

export type ObsValue = string | number | boolean;
export interface ObsEvent { t: string; ev: string; [k: string]: ObsValue }

export interface ObsOptions { salt?: string; ringSize?: number; now?: () => number }

const FIELD_KEY = /^[a-z][a-z0-9_]{0,23}$/;
const MAX_STR = 60;

const KINDS = ['ws_offline', 'ws_recovered', 'auth_rejected'] as const;
const PHASES = ['connecting', 'reconnecting', 'down'] as const;
const UAS = ['chrome', 'firefox', 'safari', 'edge', 'other'] as const;

export function createObs(opts: ObsOptions = {}) {
  const salt = opts.salt || randomBytes(32).toString('hex');
  const ringSize = opts.ringSize ?? 500;
  const now = opts.now ?? Date.now;
  const ring: ObsEvent[] = [];
  const counts = new Map<string, number>();

  const hid = (x: string): string => createHmac('sha256', salt).update(x).digest('hex').slice(0, 10);

  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);

  function event(ev: string, fields: Record<string, unknown> = {}): void {
    const out: ObsEvent = { t: new Date(now()).toISOString(), ev };
    for (const [k, v] of Object.entries(fields)) {
      if (!FIELD_KEY.test(k) || k === 't' || k === 'ev') continue;
      if (typeof v === 'string') out[k] = v.slice(0, MAX_STR);
      else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
    }
    console.log(JSON.stringify(out));
    ring.push(out);
    if (ring.length > ringSize) ring.splice(0, ring.length - ringSize);
    bump(ev);
    if (out.code !== undefined) bump(`${ev}:${out.code}`);
  }

  const isInt = (v: unknown, min: number, max: number): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

  // Validates the v1 beacon; unknown fields are dropped. Returns false when invalid.
  function clientReport(body: unknown): boolean {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
    const b = body as Record<string, unknown>;
    if (b.v !== 1) return false;
    if (typeof b.kind !== 'string' || !(KINDS as readonly string[]).includes(b.kind)) return false;
    const f: Record<string, ObsValue> = {};
    if (b.closeCode !== undefined) { if (!isInt(b.closeCode, 1000, 4999)) return false; f.code = b.closeCode; }
    if (b.closeReason !== undefined) {
      if (typeof b.closeReason !== 'string' || b.closeReason.length > 40) return false;
      f.reason = b.closeReason.replace(/[^\x20-\x7e]/g, '?');
    }
    if (b.offlineMs !== undefined) { if (!isInt(b.offlineMs, 0, 86_400_000)) return false; f.offline_ms = b.offlineMs; }
    if (b.phase !== undefined) {
      if (typeof b.phase !== 'string' || !(PHASES as readonly string[]).includes(b.phase)) return false;
      f.phase = b.phase;
    }
    for (const k of ['online', 'visible', 'mobile'] as const) {
      if (b[k] !== undefined) { if (typeof b[k] !== 'boolean') return false; f[k] = b[k] as boolean; }
    }
    if (b.app !== undefined) {
      if (typeof b.app !== 'string' || !/^[A-Za-z0-9._-]{1,24}$/.test(b.app)) return false;
      f.app = b.app;
    }
    if (b.ua !== undefined) {
      if (typeof b.ua !== 'string' || !(UAS as readonly string[]).includes(b.ua)) return false;
      f.ua = b.ua;
    }
    event(`client_${b.kind}`, f);
    return true;
  }

  return {
    hid,
    event,
    clientReport,
    counters: (): Record<string, number> => Object.fromEntries(counts),
    recent: (): ObsEvent[] => ring.slice(),
  };
}

export type Obs = ReturnType<typeof createObs>;

// Best-effort short commit from .git (the relay may not spawn, so no `git` binary). Never throws.
export function readRevision(env: string | undefined, gitDir = join(process.cwd(), '.git')): string {
  if (env?.trim()) return env.trim().slice(0, 40);
  try {
    const head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref: ')) return head.slice(0, 7);
    const ref = head.slice(5);
    try { return readFileSync(join(gitDir, ref), 'utf8').trim().slice(0, 7); } catch { /* packed */ }
    const line = readFileSync(join(gitDir, 'packed-refs'), 'utf8').split('\n').find((l) => l.endsWith(` ${ref}`));
    return line ? line.slice(0, 7) : 'unknown';
  } catch { return 'unknown'; }
}
