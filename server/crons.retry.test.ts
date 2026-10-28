import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getCrons, saveCron, markRan, recordFire } from './crons';
import { isDue, nextRunAt, RETRY_DELAY_MS, RETRY_MAX } from '../shared/cron-schedule';
import type { Cron } from '../shared/protocol';

const mk = (over: Partial<Cron> = {}): Cron => ({
  id: 'r1', name: 'x', prompt: 'oi', schedule: { kind: 'interval', everyMinutes: 60 }, enabled: true, createdAt: 0, ...over,
});

describe('routine retry', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'deck-crons-retry-')); process.env.COCKPIT_CRONS = join(dir, 'crons.json'); });
  afterEach(() => { delete process.env.COCKPIT_CRONS; try { rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ } });

  it('a failed fire schedules a retry one hour later when the cron opted in', async () => {
    await saveCron(mk({ retry: true }));
    await recordFire('r1', 'bot-busy', 1000);
    const [c] = await getCrons();
    expect(c.lastFire).toBe('bot-busy');
    expect(c.retryAt).toBe(1000 + RETRY_DELAY_MS);
    expect(c.retryCount).toBe(1);
  });
  it('no retry without the opt-in flag', async () => {
    await saveCron(mk());
    await recordFire('r1', 'blocked', 1000);
    const [c] = await getCrons();
    expect(c.lastFire).toBe('blocked');
    expect(c.retryAt).toBeUndefined();
  });
  it('stops after RETRY_MAX attempts', async () => {
    await saveCron(mk({ retry: true }));
    for (let i = 0; i < RETRY_MAX + 1; i++) await recordFire('r1', 'bot-busy', 1000 * (i + 1));
    const [c] = await getCrons();
    expect(c.retryCount).toBe(RETRY_MAX);
    expect(c.retryAt).toBeUndefined();
  });
  it('a removed bot is never retried', async () => {
    await saveCron(mk({ retry: true }));
    await recordFire('r1', 'bot-gone', 1000);
    expect((await getCrons())[0].retryAt).toBeUndefined();
  });
  it('a successful fire clears the retry state', async () => {
    await saveCron(mk({ retry: true }));
    await recordFire('r1', 'bot-busy', 1000);
    await recordFire('r1', 'started', 2000);
    const [c] = await getCrons();
    expect(c.retryAt).toBeUndefined();
    expect(c.retryCount).toBeUndefined();
    expect(c.lastFire).toBe('started');
  });
  it('markRan clears a pending retryAt so it is not fired twice', async () => {
    await saveCron(mk({ retry: true }));
    await recordFire('r1', 'bot-busy', 1000);
    await markRan('r1', 1000 + RETRY_DELAY_MS);
    expect((await getCrons())[0].retryAt).toBeUndefined();
  });
  it('isDue fires at retryAt and nextRunAt reports it when sooner', () => {
    const c = mk({ retry: true, lastRun: 0, retryAt: 5 * 60_000, schedule: { kind: 'interval', everyMinutes: 600 } });
    expect(isDue(c, 5 * 60_000 - 1)).toBe(false);
    expect(isDue(c, 5 * 60_000)).toBe(true);
    expect(nextRunAt(c, 0)).toBe(5 * 60_000);
  });
  it('a paused cron never retries', () => {
    expect(isDue(mk({ enabled: false, retryAt: 1 }), 10)).toBe(false);
  });
  it('the client cannot forge the server-owned fields on save', async () => {
    await saveCron(mk({ retry: true }));
    await recordFire('r1', 'bot-busy', 1000);
    await saveCron(mk({ retry: true, retryAt: 1, retryCount: 0, lastFire: 'started', name: 'renamed' }));
    const [c] = await getCrons();
    expect(c.name).toBe('renamed');
    expect(c.retryAt).toBe(1000 + RETRY_DELAY_MS);
    expect(c.lastFire).toBe('bot-busy');
  });
  it('a brand new cron drops forged server fields', async () => {
    await saveCron(mk({ lastFire: 'started', retryAt: 5 }));
    const [c] = await getCrons();
    expect(c.lastFire).toBeUndefined();
    expect(c.retryAt).toBeUndefined();
  });
});
