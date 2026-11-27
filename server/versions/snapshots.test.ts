import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let root: string;

vi.mock('node:os', async (orig) => {
  const os = await orig<typeof import('node:os')>();
  return { ...os, homedir: () => root };
});

beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'versions-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('snapshots', () => {
  it('records, lists newest first and reads back content', async () => {
    const { recordSnapshot, listVersions, readVersion } = await import('./snapshots');
    await recordSnapshot('agent', 'grok', 'one');
    await recordSnapshot('agent', 'grok', 'two', 'nota');
    const list = await listVersions('agent', 'grok');
    expect(list).toHaveLength(2);
    expect(list[0].note).toBe('nota');
    expect((await readVersion('agent', 'grok', list[1].version))?.content).toBe('one');
    expect((await readVersion('agent', 'grok', list[0].version))?.content).toBe('two');
  });

  it('skips a snapshot identical to the latest', async () => {
    const { recordSnapshot, listVersions } = await import('./snapshots');
    expect(await recordSnapshot('skill', 's', 'same')).not.toBeNull();
    expect(await recordSnapshot('skill', 's', 'same')).toBeNull();
    expect(await listVersions('skill', 's')).toHaveLength(1);
  });

  it('keeps ordering when two snapshots land in the same millisecond', async () => {
    const { recordSnapshot, listVersions } = await import('./snapshots');
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    await recordSnapshot('agent', 'a', '1');
    await recordSnapshot('agent', 'a', '2');
    vi.restoreAllMocks();
    const list = await listVersions('agent', 'a');
    expect(list.map((v) => v.ts)).toEqual([1_700_000_000_001, 1_700_000_000_000]);
  });

  it('marks removal as deleted', async () => {
    const { recordSnapshot, listVersions } = await import('./snapshots');
    await recordSnapshot('agent', 'a', 'x');
    await recordSnapshot('agent', 'a', null);
    const list = await listVersions('agent', 'a');
    expect(list[0].deleted).toBe(true);
    expect(list[1].deleted).toBe(false);
  });

  it('caps retained snapshots per item, dropping the oldest', async () => {
    const { recordSnapshot, listVersions } = await import('./snapshots');
    const { MAX_VERSIONS_PER_ITEM } = await import('../../shared/versions');
    for (let i = 0; i < MAX_VERSIONS_PER_ITEM + 5; i++) await recordSnapshot('skill', 'cap', `v${i}`);
    const list = await listVersions('skill', 'cap');
    expect(list).toHaveLength(MAX_VERSIONS_PER_ITEM);
    const files = await readdir(join(root, '.deck-agent', 'versions', 'skill', 'cap'));
    expect(files).toHaveLength(MAX_VERSIONS_PER_ITEM);
  });

  it('refuses traversal ids and malformed version ids', async () => {
    const { recordSnapshot, listVersions, readVersion } = await import('./snapshots');
    expect(await recordSnapshot('agent', '../evil', 'x')).toBeNull();
    expect(await listVersions('agent', 'a/b')).toEqual([]);
    expect(await readVersion('agent', 'ok', '../../etc/passwd')).toBeNull();
  });
});
