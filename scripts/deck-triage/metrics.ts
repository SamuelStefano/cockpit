import { appendFile, chmod, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Check } from './checks.ts';

const DAY_MS = 86_400_000;
export const RETENTION_MS = 14 * DAY_MS;

export type MetricEvent = 'msg_sent' | 'msg_suppressed' | 'auto_heal' | 'investigator';
export type MetricEntry =
  | { t: number; k: 'synth'; failing: string[]; login_ms?: number; auth_ok?: number; close_4408?: number; stall?: number }
  | { t: number; k: 'event'; ev: MetricEvent };

export function synthEntry(t: number, checks: Check[], failing?: readonly string[]): MetricEntry {
  const login = checks.find((c) => c.id === 'login_path')?.metrics;
  const auth = checks.find((c) => c.id === 'auth_flow')?.metrics;
  const e: MetricEntry = { t, k: 'synth', failing: failing ? [...failing] : checks.filter((c) => c.status === 'fail').map((c) => c.id) };
  if (login?.login_ms !== undefined) e.login_ms = login.login_ms;
  if (auth) Object.assign(e, { auth_ok: auth.auth_ok, close_4408: auth.close_4408, stall: auth.stall });
  return e;
}

export function parseLines(text: string): MetricEntry[] {
  const out: MetricEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try {
      const e = JSON.parse(line) as MetricEntry;
      if (typeof e?.t === 'number' && (e.k === 'synth' || e.k === 'event')) out.push(e);
    } catch { /* torn line */ }
  }
  return out;
}

export function createMetrics(stateDir: string, now: () => number = Date.now) {
  const file = join(stateDir, 'metrics.jsonl');
  const beat = join(stateDir, 'heartbeat');
  let lastPrune = 0;

  async function load(): Promise<MetricEntry[]> {
    try { return parseLines(await readFile(file, 'utf8')); } catch { return []; }
  }

  async function prune(): Promise<void> {
    lastPrune = now();
    const kept = (await load()).filter((e) => e.t >= now() - RETENTION_MS);
    const tmp = `${file}.tmp`;
    await writeFile(tmp, kept.map((e) => JSON.stringify(e)).join('\n') + (kept.length ? '\n' : ''), { mode: 0o600 });
    await rename(tmp, file);
  }

  async function append(e: MetricEntry): Promise<void> {
    try {
      await appendFile(file, `${JSON.stringify(e)}\n`, { mode: 0o600 });
      await chmod(file, 0o600).catch(() => {});
      if (now() - lastPrune >= DAY_MS) await prune();
    } catch { /* metrics are best effort */ }
  }

  return {
    prune: () => prune().catch(() => {}),
    load,
    recordSynthetic: (checks: Check[], failing?: readonly string[]) => append(synthEntry(now(), checks, failing)),
    recordEvent: (ev: MetricEvent) => append({ t: now(), k: 'event', ev }),
    async heartbeat(): Promise<void> {
      try {
        await writeFile(`${beat}.tmp`, String(Math.floor(now() / 1000)), { mode: 0o600 });
        await rename(`${beat}.tmp`, beat);
      } catch { /* best effort */ }
    },
  };
}

export interface Summary {
  runs: number;
  availability: Record<string, number>;
  loginP50: number | null;
  loginMax: number | null;
  close4408: number;
  stalls: number;
  sent: number;
  suppressed: number;
  heals: number;
  investigators: number;
}

// auth_flow counts are a rolling 10 min window sampled every 2 min, so summing them would
// count each event ~5 times: only the rises between consecutive samples are added.
const rises = (xs: number[]) => xs.reduce((sum, x, i) => sum + Math.max(0, x - (i ? xs[i - 1] : 0)), 0);

export function summarize(entries: MetricEntry[], nowMs: number, windowMs: number): Summary {
  const inWin = entries.filter((e) => e.t >= nowMs - windowMs).sort((a, b) => a.t - b.t);
  const synth = inWin.filter((e): e is Extract<MetricEntry, { k: 'synth' }> => e.k === 'synth');
  const fails = new Map<string, number>();
  for (const s of synth) for (const id of s.failing) fails.set(id, (fails.get(id) ?? 0) + 1);
  const availability: Record<string, number> = {};
  for (const [id, n] of fails) availability[id] = Math.round((1 - n / synth.length) * 1000) / 10;
  const ms = synth.map((s) => s.login_ms).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
  const events = inWin.filter((e): e is Extract<MetricEntry, { k: 'event' }> => e.k === 'event');
  const count = (ev: MetricEvent) => events.filter((e) => e.ev === ev).length;
  return {
    runs: synth.length,
    availability,
    loginP50: ms.length ? ms[Math.floor((ms.length - 1) / 2)] : null,
    loginMax: ms.length ? ms[ms.length - 1] : null,
    close4408: rises(synth.map((s) => s.close_4408 ?? 0)),
    stalls: rises(synth.map((s) => s.stall ?? 0)),
    sent: count('msg_sent'),
    suppressed: count('msg_suppressed'),
    heals: count('auto_heal'),
    investigators: count('investigator'),
  };
}

function block(label: string, s: Summary): string[] {
  const down = Object.entries(s.availability).sort((a, b) => a[1] - b[1]);
  return [
    `${label} (${s.runs} checagens)`,
    down.length ? `  disponibilidade: ${down.map(([id, p]) => `${id} ${p}%`).join(', ')}` : '  disponibilidade: tudo 100%',
    `  login: p50 ${s.loginP50 ?? '-'} ms, máx ${s.loginMax ?? '-'} ms; 4408: ${s.close4408}; travadas: ${s.stalls} (aprox.)`,
    `  mensagens: ${s.sent} enviadas, ${s.suppressed} contidas; auto-correções: ${s.heals}; investigações: ${s.investigators}`,
  ];
}

export function formatMetrics(entries: MetricEntry[], nowMs: number): string {
  return [...block('Últimas 24 h', summarize(entries, nowMs, DAY_MS)), ...block('Últimos 7 d', summarize(entries, nowMs, 7 * DAY_MS))].join('\n');
}
