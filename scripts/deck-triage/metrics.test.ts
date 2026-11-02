import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Check } from './checks.ts';
import { createMetrics, formatMetrics, parseLines, summarize, synthEntry, type MetricEntry } from './metrics.ts';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
let dir = '';
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = ''; });

const synth = (ago: number, o: Partial<Extract<MetricEntry, { k: 'synth' }>> = {}): MetricEntry => ({ t: NOW - ago, k: 'synth', failing: [], ...o });

describe('synthEntry', () => {
  it('captures failing ids, login_ms and auth counts', () => {
    const checks: Check[] = [
      { id: 'login_path', status: 'fail', detail: 'x', metrics: { login_ms: 8100 } },
      { id: 'auth_flow', status: 'ok', detail: 'x', metrics: { auth_ok: 4, close_4408: 1, stall: 0 } },
      { id: 'ssh', status: 'ok', detail: 'x' },
    ];
    expect(synthEntry(NOW, checks)).toEqual({ t: NOW, k: 'synth', failing: ['login_path'], login_ms: 8100, auth_ok: 4, close_4408: 1, stall: 0 });
  });
});

describe('summarize / formatMetrics', () => {
  const entries: MetricEntry[] = [
    synth(DAY * 3, { failing: ['dns_web'] }),
    synth(3_000, { login_ms: 100, close_4408: 0, stall: 0 }),
    synth(2_000, { failing: ['login_path'], login_ms: 300, close_4408: 3, stall: 1 }),
    synth(1_000, { login_ms: 200, close_4408: 3, stall: 1 }),
    { t: NOW - 500, k: 'event', ev: 'msg_sent' },
    { t: NOW - 400, k: 'event', ev: 'msg_suppressed' },
    { t: NOW - 300, k: 'event', ev: 'auto_heal' },
  ];

  it('computes 24 h figures without double counting the rolling window', () => {
    const s = summarize(entries, NOW, DAY);
    expect(s).toMatchObject({ runs: 3, loginP50: 200, loginMax: 300, close4408: 3, stalls: 1, sent: 1, suppressed: 1, heals: 1, investigators: 0 });
    expect(s.availability).toEqual({ login_path: 66.7 });
  });

  it('includes the older run in 7 d', () => {
    const s = summarize(entries, NOW, 7 * DAY);
    expect(s.runs).toBe(4);
    expect(s.availability.dns_web).toBe(75);
  });

  it('prints both windows as plain text', () => {
    const t = formatMetrics(entries, NOW);
    expect(t).toContain('Últimas 24 h');
    expect(t).toContain('Últimos 7 d');
    expect(t).toContain('login_path 66.7%');
  });

  it('handles an empty file', () => {
    expect(formatMetrics([], NOW)).toContain('tudo 100%');
  });
});

describe('createMetrics', () => {
  it('appends mode 600 lines, prunes old ones at startup and writes an atomic heartbeat', async () => {
    dir = mkdtempSync(join(tmpdir(), 'metrics-'));
    const file = join(dir, 'metrics.jsonl');
    writeFileSync(file, `${JSON.stringify(synth(15 * DAY))}\n${JSON.stringify(synth(DAY))}\ntorn{\n`);
    const m = createMetrics(dir, () => NOW);
    await m.prune();
    expect(parseLines(readFileSync(file, 'utf8'))).toHaveLength(1);
    await m.recordSynthetic([{ id: 'ssh', status: 'fail', detail: 'x' }]);
    await m.recordEvent('investigator');
    expect(parseLines(readFileSync(file, 'utf8')).map((e) => e.k)).toEqual(['synth', 'synth', 'event']);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    await m.heartbeat();
    expect(readFileSync(join(dir, 'heartbeat'), 'utf8')).toBe(String(Math.floor(NOW / 1000)));
  });

  it('prunes again at most once a day', async () => {
    dir = mkdtempSync(join(tmpdir(), 'metrics-'));
    let t = NOW;
    const m = createMetrics(dir, () => t);
    await m.prune();
    await m.recordEvent('auto_heal');
    t += DAY / 2;
    writeFileSync(join(dir, 'metrics.jsonl'), `${JSON.stringify(synth(t - NOW + 20 * DAY))}\n`);
    await m.recordEvent('auto_heal');
    expect(parseLines(readFileSync(join(dir, 'metrics.jsonl'), 'utf8'))).toHaveLength(2);
    t += DAY;
    await m.recordEvent('auto_heal');
    expect(parseLines(readFileSync(join(dir, 'metrics.jsonl'), 'utf8'))).toHaveLength(2);
  });
});
