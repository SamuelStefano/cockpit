import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile, appendFile, utimes, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  __resetCanvasRefsCache, acquireBackfillLock, cardIdFromRefsCache, needsFullScan, releaseBackfillLock, saveCache,
  sessionRefs, unwrapCacheEntries, waitForLockRelease, type RefsCache,
} from './index';
import { emptyTopics, type SessionRefs } from './refs';

// The cache backing cardIdFromRefsCache is module-level (warmed once per
// process, same as marathon.ts's set) — reset it so each test hits its own
// fresh COCKPIT_CANVAS_REFS file instead of a stale in-memory Map.
describe('cardIdFromRefsCache', () => {
  beforeEach(() => {
    process.env.COCKPIT_CANVAS_REFS = join(mkdtempSync(join(tmpdir(), 'canvas-refs-')), 'refs.json');
    __resetCanvasRefsCache();
  });

  it('reads cardId straight from the persisted refs cache, no transcript scan', async () => {
    writeFileSync(process.env.COCKPIT_CANVAS_REFS!, JSON.stringify({
      'sess-1': { contexts: {}, cardId: 'card-1', consumed: 100, size: 100 },
    }));
    await expect(cardIdFromRefsCache('sess-1')).resolves.toBe('card-1');
  });

  it('returns undefined for an unknown session or a missing cache file', async () => {
    await expect(cardIdFromRefsCache('nope')).resolves.toBeUndefined();
  });
});

// Real temp JSONL files: `sessionRefs` does real fs I/O (stat + read), and
// the bug this guards against (the resume branch silently dropping fields)
// only shows up when actually round-tripping through disk.

const editLine = (id: string, path: string, at: string) =>
  JSON.stringify({ type: 'assistant', timestamp: at, message: { content: [{ type: 'tool_use', id, name: 'Edit', input: { file_path: path } }] } });
const resultLine = (id: string) =>
  JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: false }] } });

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'canvas-refs-test-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('sessionRefs — incremental resume', () => {
  it('carries writes/activity forward across an append-one-line resume (blocker: used to wipe them)', async () => {
    const path = join(dir, 'sess1.jsonl');
    const l1 = editLine('e1', '/repo/a.ts', '2026-09-23T10:00:00Z') + '\n';
    const l2 = resultLine('e1') + '\n';
    await writeFile(path, l1 + l2, 'utf8');
    const consumed = Buffer.byteLength(l1 + l2);

    const hit: SessionRefs & { size: number } = {
      contexts: {}, topics: emptyTopics(),
      writes: { '/repo/a.ts': Date.parse('2026-09-23T10:00:00Z') },
      activity: [[Date.parse('2026-09-23T10:00:00Z'), Date.parse('2026-09-23T10:00:00Z')]],
      consumed, size: consumed,
    };
    const cache: RefsCache = new Map([['sess1', hit]]);

    // Simulate the session getting one more (later) write after the cache was saved.
    const l3 = editLine('e2', '/repo/b.ts', '2026-09-23T11:00:00Z') + '\n';
    const l4 = resultLine('e2') + '\n';
    await appendFile(path, l3 + l4, 'utf8');

    const refs = await sessionRefs(cache, 'sess1', path, true);

    expect(refs?.writes).toEqual({
      '/repo/a.ts': Date.parse('2026-09-23T10:00:00Z'), // carried through, not wiped
      '/repo/b.ts': Date.parse('2026-09-23T11:00:00Z'), // picked up by the tail resume
    });
    expect(refs?.activity).toEqual([[Date.parse('2026-09-23T10:00:00Z'), Date.parse('2026-09-23T10:00:00Z')], [Date.parse('2026-09-23T11:00:00Z'), Date.parse('2026-09-23T11:00:00Z')]]);
  });

  it('does not mutate the cached hit in place (copies writes/activity before tailing)', async () => {
    const path = join(dir, 'sess1.jsonl');
    const l1 = editLine('e1', '/repo/a.ts', '2026-09-23T10:00:00Z') + '\n' + resultLine('e1') + '\n';
    await writeFile(path, l1, 'utf8');
    const hit: SessionRefs & { size: number } = {
      contexts: {}, topics: emptyTopics(), writes: { '/repo/a.ts': 1 }, activity: [[1, 1]], consumed: Buffer.byteLength(l1), size: Buffer.byteLength(l1),
    };
    const cache: RefsCache = new Map([['sess1', hit]]);
    await appendFile(path, editLine('e2', '/repo/c.ts', '2026-09-23T12:00:00Z') + '\n' + resultLine('e2') + '\n', 'utf8');

    await sessionRefs(cache, 'sess1', path, true);

    expect(hit.writes).toEqual({ '/repo/a.ts': 1 }); // the original object was never touched
  });
});

describe('sessionRefs — lazy backfill', () => {
  it('fully rescans a RECENT session whose cache predates `writes`, even when the file size is unchanged', async () => {
    const path = join(dir, 'sess2.jsonl');
    const content = editLine('e1', '/repo/a.ts', '2026-09-23T10:00:00Z') + '\n' + resultLine('e1') + '\n';
    await writeFile(path, content, 'utf8');
    const size = Buffer.byteLength(content);
    // Pre-`writes` cache shape: field absent entirely, `consumed` says
    // "already read to EOF" under the old code (no writes/activity tracked).
    const hit = { contexts: {}, topics: emptyTopics(), consumed: size, size } as SessionRefs & { size: number };
    const cache: RefsCache = new Map([['sess2', hit]]);

    const refs = await sessionRefs(cache, 'sess2', path, true);

    expect(refs?.writes).toEqual({ '/repo/a.ts': Date.parse('2026-09-23T10:00:00Z') });
  });

  it('leaves an OLD (not recent) session\'s cache entry alone — no wasted rescan outside the windows that ever read it', async () => {
    const path = join(dir, 'sess3.jsonl');
    const content = editLine('e1', '/repo/a.ts', '2020-01-01T00:00:00Z') + '\n' + resultLine('e1') + '\n';
    await writeFile(path, content, 'utf8');
    const size = Buffer.byteLength(content);
    const hit = { contexts: {}, topics: emptyTopics(), consumed: size, size } as SessionRefs & { size: number };
    const cache: RefsCache = new Map([['sess3', hit]]);

    const refs = await sessionRefs(cache, 'sess3', path, false);

    expect(refs).toBe(hit); // returned as-is: no rescan attempted
    expect(refs?.writes).toBeUndefined();
  });

  it('does not attempt a full rescan when allowFullScan=false (another process holds the backfill lock) — reuses the hit as-is', async () => {
    const path = join(dir, 'sess4.jsonl');
    await writeFile(path, editLine('e1', '/repo/a.ts', '2026-09-23T10:00:00Z') + '\n' + resultLine('e1') + '\n', 'utf8');
    // Pre-`writes` cache shape, same size as the current file — would need a
    // full rescan under allowFullScan=true.
    const hit = { contexts: {}, topics: emptyTopics(), consumed: (await stat(path)).size, size: (await stat(path)).size } as SessionRefs & { size: number };
    const cache: RefsCache = new Map([['sess4', hit]]);

    const refs = await sessionRefs(cache, 'sess4', path, true, false);

    expect(refs).toBe(hit);
    expect(refs?.writes).toBeUndefined();
  });

  // Fix: a session with NO cache entry at all is a normal single-file scan,
  // not the multi-session "backfill" the lock exists to serialize — it must
  // never be starved just because some OTHER process is mid-backfill.
  it('DOES scan a brand-new session (no cache entry at all) even when allowFullScan=false', async () => {
    const path = join(dir, 'sess6.jsonl');
    await writeFile(path, editLine('e1', '/repo/a.ts', '2026-09-23T10:00:00Z') + '\n' + resultLine('e1') + '\n', 'utf8');
    const cache: RefsCache = new Map(); // no entry for 'sess6' at all

    const refs = await sessionRefs(cache, 'sess6', path, true, false);

    expect(refs?.writes).toEqual({ '/repo/a.ts': Date.parse('2026-09-23T10:00:00Z') });
    expect(cache.get('sess6')).toBeDefined(); // cached for next time too
  });
});

describe('sessionRefs — failed backfill', () => {
  it('marks writes/activity empty (not retried every canvas-get) when the backfill scan itself fails', async () => {
    // A directory at the JSONL path: stat() succeeds (so the "needs backfill"
    // branch is reached), but reading it as a file fails inside scanTail.
    const path = join(dir, 'sess5.jsonl');
    await mkdir(path);
    const hit = { contexts: {}, topics: emptyTopics(), consumed: 0, size: 0 } as SessionRefs & { size: number };
    const cache: RefsCache = new Map([['sess5', hit]]);

    const refs = await sessionRefs(cache, 'sess5', path, true);

    expect(refs?.writes).toEqual({});
    expect(refs?.activity).toEqual([]);
    // The cache entry was updated in place too — the NEXT call must not retry.
    expect(cache.get('sess5')?.writes).toEqual({});
    const again = await sessionRefs(cache, 'sess5', path, true);
    expect(again).toBe(cache.get('sess5'));
  });
});

describe('unwrapCacheEntries', () => {
  it('accepts a flat v1 map as-is', () => {
    const flat = { s1: { contexts: {}, consumed: 0, size: 10 } };
    expect(unwrapCacheEntries(flat)).toBe(flat);
  });

  it('unwraps a {version, entries} shape', () => {
    const entries = { s1: { contexts: {}, consumed: 0, size: 10 } };
    expect(unwrapCacheEntries({ version: 2, entries })).toBe(entries);
  });

  it('returns empty for null/non-object input, never throws', () => {
    expect(unwrapCacheEntries(null)).toEqual({});
    expect(unwrapCacheEntries(undefined)).toEqual({});
    expect(unwrapCacheEntries([1, 2, 3])).toEqual({});
    expect(unwrapCacheEntries('garbage')).toEqual({});
  });
});

describe('needsFullScan', () => {
  it('is true for a brand-new session (no cache hit)', () => {
    expect(needsFullScan(undefined, true)).toBe(true);
  });
  it('is true for a hit missing topics, regardless of recency', () => {
    expect(needsFullScan({ contexts: {}, consumed: 0, size: 0 } as SessionRefs & { size: number }, false)).toBe(true);
  });
  it('is true for a RECENT hit missing writes (needs backfill)', () => {
    expect(needsFullScan({ contexts: {}, topics: emptyTopics(), consumed: 0, size: 0 } as SessionRefs & { size: number }, true)).toBe(true);
  });
  it('is false for an OLD hit missing writes — never read by either window', () => {
    expect(needsFullScan({ contexts: {}, topics: emptyTopics(), consumed: 0, size: 0 } as SessionRefs & { size: number }, false)).toBe(false);
  });
  it('is false for a healthy, complete hit', () => {
    expect(needsFullScan({ contexts: {}, topics: emptyTopics(), writes: {}, consumed: 0, size: 0 } as SessionRefs & { size: number }, true)).toBe(false);
  });
});

describe('acquireBackfillLock / releaseBackfillLock', () => {
  const prevEnv = process.env.COCKPIT_CANVAS_REFS;
  beforeEach(() => { process.env.COCKPIT_CANVAS_REFS = join(dir, 'canvas-refs.json'); });
  afterEach(() => { process.env.COCKPIT_CANVAS_REFS = prevEnv; });

  it('a second acquire fails while the first still holds it; release lets a third succeed', async () => {
    expect(await acquireBackfillLock()).toBe(true);
    expect(await acquireBackfillLock()).toBe(false);
    await releaseBackfillLock();
    expect(await acquireBackfillLock()).toBe(true);
    await releaseBackfillLock();
  });

  it('steals a STALE lock (holder crashed without releasing) instead of blocking forever', async () => {
    expect(await acquireBackfillLock()).toBe(true);
    const lockPath = `${process.env.COCKPIT_CANVAS_REFS}.lock`;
    const old = new Date(Date.now() - 10 * 60_000); // older than BACKFILL_LOCK_STALE_MS (5min)
    await utimes(lockPath, old, old);
    expect(await acquireBackfillLock()).toBe(true); // stolen, not blocked
    await releaseBackfillLock();
  });

  it('release is a no-op when nothing is held', async () => {
    await expect(releaseBackfillLock()).resolves.toBeUndefined();
  });

  it('waitForLockRelease resolves true immediately when nothing is held', async () => {
    await expect(waitForLockRelease(500, 50)).resolves.toBe(true);
  });

  it('waitForLockRelease resolves true once another process releases mid-wait', async () => {
    expect(await acquireBackfillLock()).toBe(true);
    setTimeout(() => { releaseBackfillLock(); }, 100);
    await expect(waitForLockRelease(2000, 50)).resolves.toBe(true);
  });

  it('waitForLockRelease gives up and resolves false once its budget runs out on a lock that never frees', async () => {
    expect(await acquireBackfillLock()).toBe(true);
    await expect(waitForLockRelease(150, 50)).resolves.toBe(false);
    await releaseBackfillLock();
  });
});

describe('saveCache — never clobber a bigger cache already on disk', () => {
  const prevEnv = process.env.COCKPIT_CANVAS_REFS;
  beforeEach(() => { process.env.COCKPIT_CANVAS_REFS = join(dir, 'canvas-refs.json'); });
  afterEach(() => { process.env.COCKPIT_CANVAS_REFS = prevEnv; });

  const hit = (n: number) => ({ contexts: {}, topics: emptyTopics(), consumed: n, size: n }) as SessionRefs & { size: number };

  it('merges in disk-only entries instead of dropping them when the in-memory map is smaller', async () => {
    // Simulates the backfill winner's on-disk result...
    await saveCache(new Map([['a', hit(1)], ['b', hit(2)], ['c', hit(3)]]));
    // ...then the LOSER (older/smaller in-memory snapshot, never saw 'c') saves.
    const loserCache: RefsCache = new Map([['a', hit(1)], ['b', hit(2)]]);
    await saveCache(loserCache);

    const onDisk = unwrapCacheEntries(JSON.parse(await readFile(process.env.COCKPIT_CANVAS_REFS!, 'utf8')));
    expect(Object.keys(onDisk).sort()).toEqual(['a', 'b', 'c']); // 'c' survived
  });

  it('a genuinely smaller save (real deletions) is NOT blocked when the in-memory map already has just as many, or more, entries', async () => {
    await saveCache(new Map([['a', hit(1)], ['b', hit(2)]]));
    // Same size (2), 'b' replaced by 'c' — a real prune/replace, not staleness.
    await saveCache(new Map([['a', hit(1)], ['c', hit(3)]]));

    const onDisk = unwrapCacheEntries(JSON.parse(await readFile(process.env.COCKPIT_CANVAS_REFS!, 'utf8')));
    expect(Object.keys(onDisk).sort()).toEqual(['a', 'c']); // 'b' really is gone, not resurrected
  });

  it('writes as-is when there is nothing on disk yet', async () => {
    await saveCache(new Map([['a', hit(1)]]));
    const onDisk = unwrapCacheEntries(JSON.parse(await readFile(process.env.COCKPIT_CANVAS_REFS!, 'utf8')));
    expect(Object.keys(onDisk)).toEqual(['a']);
  });
});
