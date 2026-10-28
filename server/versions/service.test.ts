import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let root: string;

vi.mock('node:os', async (orig) => {
  const os = await orig<typeof import('node:os')>();
  return { ...os, homedir: () => root };
});
vi.mock('../config', () => ({ CONFIG: { get skillsDir() { return join(root, 'skills'); } } }));

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'versions-svc-'));
  vi.resetModules();
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('agent history', () => {
  it('snapshots each save, diffs, and restore creates a new snapshot equal to the old', async () => {
    const store = await import('../agents/store');
    const svc = await import('./service');
    await store.addCustomAgent({ id: 'gem', name: 'Gem', command: 'gemini', args: ['--acp'] });
    await store.addCustomAgent({ id: 'gem', name: 'Gem 2', command: 'gemini', args: ['--acp', '--x'] });
    const list = await svc.versionsFor('agent', 'gem');
    expect(list).toHaveLength(2);
    const d = await svc.diffVersions('agent', 'gem', list[1].version, list[0].version);
    expect(d.ok && d.diff).toContain('+  "name": "Gem 2"');
    const r = await svc.restoreVersion('agent', 'gem', list[1].version);
    expect(r.ok).toBe(true);
    expect(store.findAgent('gem')?.name).toBe('Gem');
    const after = await svc.versionsFor('agent', 'gem');
    expect(after).toHaveLength(3);
    expect(after[0].note).toContain('restaurada');
  });

  it('records removal and refuses to restore the removal marker', async () => {
    const store = await import('../agents/store');
    const svc = await import('./service');
    await store.addCustomAgent({ id: 'gem', name: 'Gem', command: 'gemini', args: [] });
    await store.removeAgent('gem');
    const list = await svc.versionsFor('agent', 'gem');
    expect(list[0].deleted).toBe(true);
    expect((await svc.restoreVersion('agent', 'gem', list[0].version)).ok).toBe(false);
    expect((await svc.restoreVersion('agent', 'gem', list[1].version)).ok).toBe(true);
    expect(store.findAgent('gem')?.name).toBe('Gem');
  });
});

describe('skill history', () => {
  it('captures disk edits on listing and restores SKILL.md', async () => {
    const svc = await import('./service');
    const dir = join(root, 'skills', 'demo');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'SKILL.md'), 'v1\n');
    const first = await svc.versionsFor('skill', 'demo');
    expect(first).toHaveLength(1);
    await writeFile(join(dir, 'SKILL.md'), 'v2\n');
    const second = await svc.versionsFor('skill', 'demo');
    expect(second).toHaveLength(2);
    const r = await svc.restoreVersion('skill', 'demo', first[0].version);
    expect(r.ok).toBe(true);
    expect(await readFile(join(dir, 'SKILL.md'), 'utf8')).toBe('v1\n');
    expect(await svc.versionsFor('skill', 'demo')).toHaveLength(3);
  });

  it('rejects malformed ids and versions', async () => {
    const svc = await import('./service');
    expect((await svc.restoreVersion('skill', '../x', '0000000000000-abcdef12')).ok).toBe(false);
    expect((await svc.restoreVersion('skill', 'demo', 'nope')).ok).toBe(false);
  });
});
