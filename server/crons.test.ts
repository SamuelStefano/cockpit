import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDue, nextRunAt, getCrons, saveCron, markRan, runCronNow } from './crons';
import type { Cron } from '../shared/protocol';

const base = (over: Partial<Cron>): Cron => ({
  id: 'c1', name: 'x', prompt: 'oi', schedule: { kind: 'interval', everyMinutes: 60 },
  enabled: true, createdAt: 0, ...over,
});

describe('cron interval', () => {
  it('vence quando passou o intervalo desde o último run', () => {
    const c = base({ schedule: { kind: 'interval', everyMinutes: 10 }, lastRun: 0 });
    expect(isDue(c, 9 * 60_000)).toBe(false);
    expect(isDue(c, 10 * 60_000)).toBe(true);
  });
  it('usa createdAt quando nunca rodou', () => {
    const c = base({ schedule: { kind: 'interval', everyMinutes: 5 }, createdAt: 1000, lastRun: undefined });
    expect(isDue(c, 1000 + 5 * 60_000)).toBe(true);
  });
  it('desabilitado nunca vence', () => {
    expect(isDue(base({ enabled: false, lastRun: 0 }), 999 * 60_000)).toBe(false);
  });
  it('nextRunAt = último + intervalo', () => {
    const c = base({ schedule: { kind: 'interval', everyMinutes: 30 }, lastRun: 100 });
    expect(nextRunAt(c, 100)).toBe(100 + 30 * 60_000);
  });
});

describe('cron daily (Brasília)', () => {
  // Explicit UTC instants: the schedule is anchored to UTC-3 whatever the host timezone.
  const at = (iso: string) => new Date(iso).getTime();
  const noonBrt = at('2026-06-23T15:00:00Z');
  const midnightBrt = at('2026-06-23T03:00:00Z');
  it('vence quando o slot de hoje já passou e não rodou hoje', () => {
    const c = base({ schedule: { kind: 'daily', atMinute: 9 * 60 } });
    expect(isDue(c, noonBrt)).toBe(true);
  });
  it('NÃO vence se já rodou hoje após o slot', () => {
    const c = base({ schedule: { kind: 'daily', atMinute: 9 * 60 }, lastRun: midnightBrt + 9 * 60 * 60_000 + 1000 });
    expect(isDue(c, noonBrt)).toBe(false);
  });
  it('NÃO vence antes do slot', () => {
    const c = base({ schedule: { kind: 'daily', atMinute: 18 * 60 } });
    expect(isDue(c, noonBrt)).toBe(false);
    expect(nextRunAt(c, noonBrt)).toBe(midnightBrt + 18 * 60 * 60_000);
  });
  it('a "07:00" cron fires at 10:00 UTC, not at 07:00 UTC', () => {
    const c = base({ schedule: { kind: 'daily', atMinute: 7 * 60 } });
    expect(isDue(c, at('2026-09-10T07:00:30Z'))).toBe(false);
    expect(isDue(c, at('2026-09-10T10:00:30Z'))).toBe(true);
  });
});

describe('runCronNow', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'deck-crons-run-')); process.env.COCKPIT_CRONS = join(dir, 'crons.json'); });
  afterEach(() => { delete process.env.COCKPIT_CRONS; try { rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ } });

  it('records lastRun, fires, and returns the updated list', async () => {
    await saveCron(base({ id: 'r' }));
    const fired: string[] = [];
    const items = await runCronNow('r', (c) => fired.push(c.id), 7000);
    expect(fired).toEqual(['r']);
    expect(items?.[0]).toMatchObject({ lastRun: 7000, enabled: true });
    expect((await getCrons())[0].lastRun).toBe(7000);
  });
  it('leaves a one-shot armed for its scheduled time', async () => {
    await saveCron(base({ id: 'o', schedule: { kind: 'once', atMs: 9_000_000 } }));
    await runCronNow('o', () => {}, 7000);
    const c = (await getCrons())[0];
    expect(c).toMatchObject({ enabled: true });
    expect(c.lastRun).toBeUndefined();
    expect(isDue(c, 9_000_001)).toBe(true);
  });
  it('returns null for an unknown id without firing', async () => {
    let fired = false;
    expect(await runCronNow('missing', () => { fired = true; })).toBeNull();
    expect(fired).toBe(false);
  });
});

describe('markRan', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'deck-crons-')); process.env.COCKPIT_CRONS = join(dir, 'crons.json'); });
  afterEach(() => { delete process.env.COCKPIT_CRONS; try { rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ } });

  it('grava lastRun e mantém recorrentes ativos', async () => {
    await saveCron(base({ id: 'r' }));
    await markRan('r', 5000);
    expect((await getCrons())[0]).toMatchObject({ lastRun: 5000, enabled: true });
  });
  it('pausa o "uma vez" ao disparar', async () => {
    await saveCron(base({ id: 'o', schedule: { kind: 'once', atMs: 1000 } }));
    await markRan('o', 1200);
    const c = (await getCrons())[0];
    expect(c).toMatchObject({ lastRun: 1200, enabled: false });
    expect(isDue(c, 9_000_000)).toBe(false);
  });
});
