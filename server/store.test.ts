import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// store.ts lê COCKPIT_STORE no topo do módulo, então o env precisa estar setado
// ANTES do import — daí o import dinâmico dentro de cada teste, com um arquivo
// temporário por teste pra isolar o cache de módulo entre runs.
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'cockpit-store-'));
  process.env.COCKPIT_STORE = join(dir, 'store.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function freshStore() {
  // resetModules garante cache de módulo limpo (o `cache` é estado de módulo).
  vi.resetModules();
  return import('./store');
}

describe('store concurrency', () => {
  it('keeps both ids when two hides race (no lost update)', async () => {
    const s = await freshStore();
    await Promise.all([s.hideSession(A), s.hideSession(B)]);
    const onDisk = JSON.parse(await readFile(process.env.COCKPIT_STORE!, 'utf8'));
    expect(onDisk.hidden.sort()).toEqual([A, B].sort());
    expect((await s.hiddenSet()).size).toBe(2);
  });

  it('hide then unhide of the same id races to empty', async () => {
    const s = await freshStore();
    await s.hideSession(A);
    await Promise.all([s.hideSession(B), s.unhideSession(A)]);
    const set = await s.hiddenSet();
    expect(set.has(A)).toBe(false);
    expect(set.has(B)).toBe(true);
  });

  it('ignores non-UUID ids', async () => {
    const s = await freshStore();
    await s.hideSession('not-a-uuid');
    expect((await s.hiddenSet()).size).toBe(0);
  });
});
