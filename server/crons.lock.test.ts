import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getCrons, saveCron, markRan } from './crons';
import type { Cron } from '../shared/protocol';

let dir: string;
let file: string;
const cron = (id: string): Cron => ({ id, name: id, prompt: 'oi', schedule: { kind: 'interval', everyMinutes: 60 }, enabled: true, createdAt: 0 });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deck-crons-lock-'));
  file = join(dir, 'crons.json');
  process.env.COCKPIT_CRONS = file;
});
afterEach(() => {
  delete process.env.COCKPIT_CRONS;
  rmSync(dir, { recursive: true, force: true });
});

describe('crons.json shared by two processes', () => {
  it('waits for the lock held by the other process before its read-modify-write', async () => {
    await saveCron(cron('a'));
    writeFileSync(`${file}.lock`, '');
    const started = Date.now();
    setTimeout(() => rmSync(`${file}.lock`, { force: true }), 80);
    await markRan('a', 123);
    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
    expect((await getCrons())[0].lastRun).toBe(123);
    expect(existsSync(`${file}.lock`)).toBe(false);
  });

  it('never writes through the shared crons.json.tmp name', async () => {
    writeFileSync(`${file}.tmp`, 'another process mid-write');
    await saveCron(cron('b'));
    expect((await getCrons()).map((c) => c.id)).toEqual(['b']);
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual(['crons.json.tmp']);
  });
});
