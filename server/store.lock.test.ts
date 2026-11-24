import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const A = '11111111-1111-1111-1111-111111111111';
let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cockpit-store-lock-'));
  file = join(dir, 'store.json');
  process.env.COCKPIT_STORE = file;
  vi.resetModules();
});
afterEach(async () => {
  delete process.env.COCKPIT_STORE;
  await rm(dir, { recursive: true, force: true });
});

describe('store.json shared by the index and the agent', () => {
  it('waits for the other process’s lock before archiving', async () => {
    const store = await import('./store');
    writeFileSync(`${file}.lock`, '');
    const started = Date.now();
    setTimeout(() => rmSync(`${file}.lock`, { force: true }), 80);
    await store.hideSession(A);
    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
    expect((await store.hiddenSet()).has(A)).toBe(true);
    expect(existsSync(`${file}.lock`)).toBe(false);
  });
});
