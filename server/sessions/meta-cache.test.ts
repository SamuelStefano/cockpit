import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, appendFile, readFile, utimes, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG } from '../config';
import { listSessions, metaForId, flushMetaCache, resetMetaCacheForTests } from './index';

vi.mock('node:fs/promises', async (orig) => {
  const m = await orig<typeof import('node:fs/promises')>();
  return { ...m, open: vi.fn(m.open) };
});

const ID = '12345678-1234-1234-1234-123456789abc';
const line = (o: object) => JSON.stringify(o) + '\n';
const userLine = (text: string) => line({ type: 'user', timestamp: '2026-01-01T00:00:00Z', message: { content: text } });

let dir: string;
let jsonl: string;
let cacheFile: string;
const origProjects = CONFIG.projectsDir;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'meta-cache-'));
  jsonl = join(dir, `${ID}.jsonl`);
  cacheFile = join(dir, 'session-meta-cache.json');
  process.env.COCKPIT_SESSION_META_CACHE = cacheFile;
  (CONFIG as any).projectsDir = dir;
  resetMetaCacheForTests();
  vi.mocked(open).mockClear();
  await writeFile(jsonl, userLine('hello'));
});

afterEach(async () => {
  (CONFIG as any).projectsDir = origProjects;
  delete process.env.COCKPIT_SESSION_META_CACHE;
  resetMetaCacheForTests();
  await rm(dir, { recursive: true, force: true });
});

const opensOfJsonl = () => vi.mocked(open).mock.calls.filter((c) => String(c[0]) === jsonl).length;

describe('session meta cache', () => {
  it('scans a file once for concurrent callers', async () => {
    const results = await Promise.all([metaForId(ID), listSessions(), metaForId(ID)]);
    expect(results[0]?.count).toBe(1);
    expect(results[2]?.count).toBe(1);
    expect(opensOfJsonl()).toBe(1);
  });

  it('persists only mtime, size and scan', async () => {
    await metaForId(ID);
    await flushMetaCache();
    const saved = JSON.parse(await readFile(cacheFile, 'utf8'));
    expect(Object.keys(saved)).toEqual([ID]);
    expect(Object.keys(saved[ID]).sort()).toEqual(['mtime', 'scan', 'size']);
  });

  it('reuses the persisted cache after in-memory state is cleared', async () => {
    await metaForId(ID);
    await flushMetaCache();
    resetMetaCacheForTests();
    vi.mocked(open).mockClear();
    expect((await metaForId(ID))?.count).toBe(1);
    expect(opensOfJsonl()).toBe(0);
  });

  it('ignores a corrupt cache file', async () => {
    await writeFile(cacheFile, '{not json');
    expect((await metaForId(ID))?.count).toBe(1);
    expect(opensOfJsonl()).toBe(1);
  });

  it('rescans when the mtime no longer matches the persisted entry', async () => {
    await metaForId(ID);
    await flushMetaCache();
    const later = new Date(Date.now() + 60_000);
    await utimes(jsonl, later, later);
    resetMetaCacheForTests();
    vi.mocked(open).mockClear();
    expect((await metaForId(ID))?.count).toBe(1);
    expect(opensOfJsonl()).toBe(1);
  });

  it('scans only the new tail when the file grew past the persisted size', async () => {
    await metaForId(ID);
    await flushMetaCache();
    resetMetaCacheForTests();
    await appendFile(jsonl, userLine('second'));
    expect((await metaForId(ID))?.count).toBe(2);
  });

  it('prunes persisted entries whose jsonl is gone', async () => {
    await writeFile(cacheFile, JSON.stringify({ [ID]: { mtime: 1, size: 1, scan: { title: '', count: 9, consumed: 1 } } }));
    await rm(jsonl);
    await listSessions();
    await flushMetaCache();
    expect(JSON.parse(await readFile(cacheFile, 'utf8'))).toEqual({});
  });
});
