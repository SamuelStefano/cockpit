import { open, readdir, readFile, stat, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import type { CanvasBoard, CanvasGraph } from '../../shared/canvas';
import { CONFIG } from '../config';
import { parseFrontmatter, stripFrontmatter } from '../frontmatter';
import { listSessions, listArchived } from '../sessions/index';
import { buildCanvasGraph, originSession, wikilinks, type ContextDoc } from './graph';
import { emptyRefs, scanRefsBuffer, type SessionRefs } from './refs';
import { readBoard } from './board';

// FS side of the canvas: scans every transcript for memory references (tail-only
// after the first pass, persisted so a restart does not re-read ~1 GB of JSONL)
// and every memory file for wikilinks, then hands both to the pure builder.

const CHUNK = 4 * 1024 * 1024;
const SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;
// A session whose OWN activity could still fall inside the conflict (48h) or
// timeline (7d) window. A cache entry from before `writes`/`activity` existed
// only needs backfilling — a full from-0 rescan of THAT session, not every
// session — when it's this recent; an old, cold session's history is never
// read by either feature, so its stale cache entry is left alone.
const RECENT_BACKFILL_MS = 7 * 24 * 3600_000;
// Persist progress this often during a long first-pass scan (many sessions,
// each up to ~64MB) so a crash/OOM mid-scan does not throw away everything
// already read.
const SAVE_EVERY = 25;
// A held lock older than this is presumed to belong to a process that died
// without releasing it (crash, kill -9) — stolen rather than honored forever.
// A full backfill of every recent session takes single-digit seconds even on
// a slow box, so 5 minutes is generous.
const BACKFILL_LOCK_STALE_MS = 5 * 60_000;

function refsFile(): string {
  return process.env.COCKPIT_CANVAS_REFS ?? join(homedir(), '.cockpit', 'canvas-refs.json');
}
function lockFile(): string {
  return `${refsFile()}.lock`;
}
// The archive has 3 subdirs (`memory-gc`'s destinations); the "arquivo" toggle
// used to only read `handoffs/` (a handful of files) and silently ignored
// `stale/` and `full/` (the bulk of what gets archived), so most archived
// contexts never showed up (canvas review #11).
function archiveDirs(): string[] {
  const base = process.env.COCKPIT_MEMORY_ARCHIVE ?? join(homedir(), '.claude', 'memory-archive');
  return ['handoffs', 'stale', 'full'].map((d) => join(base, d));
}

export type RefsCache = Map<string, SessionRefs & { size: number }>;
let cache: RefsCache | null = null;

// The cache file has been both a flat `{id: entry}` map (v1) and, briefly, a
// `{version, entries}` wrapper — accept either so a box that happens to have
// either shape on disk never pays a full from-0 rescan of every session just
// because the wrapper looked unfamiliar.
export function unwrapCacheEntries(raw: unknown): Record<string, SessionRefs & { size: number }> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const entries = (raw as { entries?: unknown }).entries;
  if (entries && typeof entries === 'object' && !Array.isArray(entries)) return entries as Record<string, SessionRefs & { size: number }>;
  return raw as Record<string, SessionRefs & { size: number }>;
}

// Always hits disk (no module-cache short-circuit) — used both by the very
// first load and by the lock-contention reload below, which specifically
// needs to see whatever another process just wrote, not this process's own
// possibly-stale in-memory copy.
async function readCacheFileFresh(): Promise<RefsCache> {
  try {
    const raw = JSON.parse(await readFile(refsFile(), 'utf8'));
    return new Map(Object.entries(unwrapCacheEntries(raw)));
  } catch {
    return new Map();
  }
}

async function loadCache(): Promise<RefsCache> {
  if (cache) return cache;
  cache = await readCacheFileFresh();
  return cache;
}

// Durable fallback for server/canvas/card-sessions.ts's in-memory map: that
// map only knows a binding once THIS process has seen the marker once (this
// process's boot, or a fresh restart, starts it empty). Reuses the SAME
// in-memory/disk cache buildCanvas already maintains — reading it (one JSON
// parse, at most, if nothing has loaded it yet this process) is orders of
// magnitude cheaper than a full buildCanvas() (which also, on top of the
// cost, ignores its `board` argument while a build is already in flight —
// never call it per flow fire). Callers should feed a hit back into
// bindCardSession so the next lookup skips this disk read entirely.
export async function cardIdFromRefsCache(sessionId: string): Promise<string | undefined> {
  const c = await loadCache();
  return c.get(sessionId)?.cardId;
}

// Test-only: the cache is module-level (warmed once per process, same as
// marathon.ts's set), so a test that writes a fresh refs file needs a way to
// force the next read to hit disk again.
export function __resetCanvasRefsCache(): void {
  cache = null;
}

// Own tmp filename per call (pid + random), not a fixed `${f}.tmp`: two Deck
// processes pointed at the same cache path (a stray second instance, a script,
// or the loser of a contested backfill lock — see acquireBackfillLock below)
// would otherwise race on the SAME tmp file and tear each other's write.
//
// Entry COUNT is a cheap, good-enough generation proxy: never let a smaller
// in-memory snapshot clobber a bigger one already on disk. A process that
// lost the backfill lock (or just hasn't scanned as much this pass as
// whoever wrote last) used to save its own incomplete `c` unconditionally,
// clobbering the winner's freshly-completed backfill on the next checkpoint —
// this merges in whatever keys the current on-disk file has that `c` is
// missing before writing, so a "last writer" can only ever ADD to what's on
// disk, never erase it.
export async function saveCache(c: RefsCache): Promise<void> {
  const f = refsFile();
  await mkdir(dirname(f), { recursive: true });
  try {
    const onDisk = new Map(Object.entries(unwrapCacheEntries(JSON.parse(await readFile(f, 'utf8')))));
    if (onDisk.size > c.size) for (const [id, entry] of onDisk) if (!c.has(id)) c.set(id, entry);
  } catch { /* no file yet, or unreadable/corrupt — nothing on disk to protect */ }
  const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, JSON.stringify(Object.fromEntries(c)), 'utf8');
  await rename(tmp, f);
}

// Exclusive, O_EXCL-style lock (`wx` fails if the file already exists) around
// the expensive first backfill — two Deck processes on the same cache file
// (a rolling restart briefly running old+new, a stray second instance) would
// otherwise both walk every recent session's JSONL at once. The loser just
// reuses whatever is already in its own cache (see `allowFullScan` below)
// instead of redoing the same I/O.
export async function acquireBackfillLock(): Promise<boolean> {
  const lp = lockFile();
  await mkdir(dirname(lp), { recursive: true });
  const claim = async () => {
    const fh = await open(lp, 'wx');
    await fh.writeFile(String(process.pid));
    await fh.close();
  };
  try {
    await claim();
    return true;
  } catch {
    // Held by someone else — unless it's stale (the holder crashed without
    // releasing it), in which case it's stolen rather than honored forever.
    let stale = false;
    try { stale = Date.now() - (await stat(lp)).mtimeMs >= BACKFILL_LOCK_STALE_MS; } catch { return false; }
    if (!stale) return false;
    try { await rm(lp, { force: true }); await claim(); return true; } catch { return false; }
  }
}

export async function releaseBackfillLock(): Promise<void> {
  await rm(lockFile(), { force: true }).catch(() => undefined);
}

// How long the LOSER of a contested lock waits for the winner to finish
// before giving up and falling back to the old read-only-hit behavior. A full
// backfill of every recent session takes single-digit seconds (see
// BACKFILL_LOCK_STALE_MS above) — bounded well under that stale-lock ceiling
// so a genuinely stuck/crashed holder doesn't leave this loser hanging.
const LOCK_WAIT_MS = 8_000;
const LOCK_POLL_MS = 250;

// Polls (not fs.watch — a handful of checks over a few seconds isn't worth a
// watcher's own setup/teardown cost) until the lock file is gone or the
// budget runs out. Exported so the "reload after the winner finishes"
// behavior in buildCanvas has coverage without a real multi-second sleep in
// every test that exercises it.
export async function waitForLockRelease(deadlineMs = LOCK_WAIT_MS, pollMs = LOCK_POLL_MS): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    try {
      await stat(lockFile());
    } catch {
      return true; // gone: released (or never existed)
    }
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

// Same trigger `sessionRefs` uses internally to decide a full rescan is
// coming (missing topics, missing writes on a recent session, or no cache
// entry at all) — checked BEFORE touching the filesystem so a normal
// canvas-get (everything just tail-resuming) never pays for the lock.
export function needsFullScan(hit: (SessionRefs & { size: number }) | undefined, recent: boolean): boolean {
  if (!hit || !hit.topics) return true;
  return recent && !hit.writes;
}

// Reads from `refs.consumed` to EOF in bounded chunks; a partial last line is
// left for the next pass (the session may still be writing it).
async function scanTail(path: string, refs: SessionRefs): Promise<void> {
  const fh = await open(path, 'r');
  try {
    let carry = Buffer.alloc(0);
    let pos = refs.consumed;
    for (;;) {
      const buf = Buffer.alloc(CHUNK);
      const { bytesRead } = await fh.read(buf, 0, CHUNK, pos);
      if (!bytesRead) break;
      pos += bytesRead;
      const data = carry.length ? Buffer.concat([carry, buf.subarray(0, bytesRead)]) : buf.subarray(0, bytesRead);
      const used = scanRefsBuffer(data, refs);
      carry = Buffer.from(data.subarray(used));
      if (carry.length > 64 * 1024 * 1024) break; // a single absurd line: stop rather than hold it all
    }
  } finally {
    await fh.close();
  }
}

// `path` injected rather than built from CONFIG.projectsDir here: keeps this
// testable against a real temp file without faking global config.
// `allowFullScan=false` skips a full BACKFILL rescan (an existing hit missing
// topics/writes) and just returns the existing hit — used when another
// process already holds the backfill lock, so the two never duplicate the
// same expensive multi-session walk. A session with NO cache entry at all is
// exempt from that gate: scanning ONE brand-new session's own transcript from
// 0 is a normal, cheap single-file read, not the "walk every recent session"
// cost the lock exists to serialize — a review found this loop making a
// genuinely new session wait out someone else's unrelated backfill (or worse,
// return `undefined` and never get scanned at all) for no reason.
export async function sessionRefs(c: RefsCache, id: string, path: string, recent: boolean, allowFullScan = true): Promise<SessionRefs | undefined> {
  let size: number;
  try { size = (await stat(path)).size; } catch { return c.get(id); }
  const hit = c.get(id);
  // A hit missing `writes` predates that field entirely (old cache, never
  // serialized it). Only worth a backfill when the session is recent enough
  // that the 48h conflict / 7d timeline windows could still read it — an old
  // session's cache entry is left exactly as it was.
  const needsBackfill = recent && hit && !hit.writes;
  if (hit && hit.size === size && hit.topics && !needsBackfill) return hit;
  // Shrunk = rewritten (compaction tooling, manual edit): the offset is meaningless.
  // A hit missing `topics`, or one that needs the writes/activity backfill
  // above, was never scanned for those fields either way: both are a full
  // rescan from 0 rather than a tail resume. writes/activity/pendingWrites/
  // contextHits are COPIED (new object/array), never aliased to `hit` — a
  // scanTail failure below must leave the cached hit untouched, and a
  // mutation deep inside addWrite/addActivity on a shared reference would
  // otherwise corrupt it.
  const canResume = hit && hit.topics && size > hit.size && !needsBackfill;
  const brandNew = !hit;
  if (!canResume && !brandNew && !allowFullScan) return hit;
  const refs: SessionRefs = canResume
    ? {
        contexts: { ...hit.contexts }, contextHits: hit.contextHits ? { ...hit.contextHits } : undefined,
        cardId: hit.cardId, topics: hit.topics,
        writes: { ...(hit.writes ?? {}) },
        activity: (hit.activity ?? []).map(([s, e]): [number, number] => [s, e]),
        pendingWrites: { ...(hit.pendingWrites ?? {}) },
        consumed: hit.consumed,
      }
    : emptyRefs();
  try { await scanTail(path, refs); } catch {
    if (needsBackfill && hit) {
      // A permanently unreadable/corrupt file would otherwise retry this
      // exact backfill — and fail again — on EVERY canvas-get forever. Mark
      // writes/activity "attempted, empty" so `needsBackfill` goes false from
      // here on; everything else about the old hit is left untouched.
      const failed: SessionRefs & { size: number } = { ...hit, writes: hit.writes ?? {}, activity: hit.activity ?? [] };
      c.set(id, failed);
      return failed;
    }
    return hit;
  }
  c.set(id, { ...refs, size });
  return refs;
}

async function readContextDir(dir: string, archived: boolean): Promise<ContextDoc[]> {
  let files: string[];
  try { files = await readdir(dir); } catch { return []; }
  const out: ContextDoc[] = [];
  for (const f of files) {
    if (!f.endsWith('.md') || f === 'MEMORY.md') continue;
    const id = f.slice(0, -3);
    if (!SLUG_RE.test(id)) continue;
    const path = join(dir, f);
    try {
      const [st, raw] = await Promise.all([stat(path), readFile(path, 'utf8')]);
      const head = raw.slice(0, 2000);
      const fm = parseFrontmatter(head);
      out.push({
        id, name: fm.name || id, title: fm.name || id.replace(/[-_]/g, ' '), description: fm.description || '',
        mtime: st.mtimeMs, links: wikilinks(stripFrontmatter(raw)), origin: originSession(head), archived, path,
      });
    } catch { /* vanished between readdir and read */ }
  }
  return out;
}

let inflight: Promise<CanvasGraph> | null = null;

export function buildCanvas(board?: CanvasBoard, running?: Set<string>): Promise<CanvasGraph> {
  if (inflight) return inflight;
  inflight = (async () => {
    const c = await loadCache();
    const [live, archived, b] = await Promise.all([listSessions(), listArchived(), board ? Promise.resolve(board) : readBoard()]);
    const sessions = [...live.map((meta) => ({ meta, archived: false })), ...archived.map((meta) => ({ meta, archived: true }))];
    const now = Date.now();
    // Lock only when there's an actual BACKFILL coming — an EXISTING hit
    // missing topics/writes, the multi-session walk the lock exists to
    // serialize. A session with no cache entry at all doesn't count here:
    // sessionRefs's own `brandNew` exemption lets it scan without the lock
    // (a normal single-file read), so a box with a few new sessions but no
    // real backfill pending never bothers contending for the lock at all.
    const anyBackfillPending = sessions.some(({ meta }) => {
      const hit = c.get(meta.id);
      return !!hit && needsFullScan(hit, now - meta.mtime < RECENT_BACKFILL_MS);
    });
    const holdingLock = anyBackfillPending && await acquireBackfillLock();
    if (anyBackfillPending && !holdingLock && await waitForLockRelease()) {
      // Lost the race, but the winner finished before our wait budget ran
      // out: pick up whatever it just wrote BEFORE scanning anything —
      // otherwise this process's own (older) in-memory cache would still
      // think every one of those sessions needs a backfill, redo the exact
      // walk the winner just did, and then (worse) save its redundant result
      // on top, clobbering the winner's progress on the next checkpoint.
      const fresh = await readCacheFileFresh();
      for (const [id, entry] of fresh) c.set(id, entry);
    }
    const allowFullScan = !anyBackfillPending || holdingLock;
    const refs = new Map<string, SessionRefs>();
    try {
      let sinceSave = 0;
      for (const { meta } of sessions) {
        const recent = now - meta.mtime < RECENT_BACKFILL_MS;
        const path = join(CONFIG.projectsDir, `${meta.id}.jsonl`);
        const r = await sessionRefs(c, meta.id, path, recent, allowFullScan);
        if (r) refs.set(meta.id, r);
        // Checkpoint periodically: the first full backfill after a deploy walks
        // every recent session's JSONL (seconds each) — a crash/OOM partway
        // through would otherwise lose everything read so far, not just the
        // one session in flight.
        if (++sinceSave >= SAVE_EVERY) { sinceSave = 0; await saveCache(c).catch(() => undefined); }
      }
    } finally {
      if (holdingLock) await releaseBackfillLock();
    }
    const live_ = new Set(sessions.map((s) => s.meta.id));
    for (const id of c.keys()) if (!live_.has(id)) c.delete(id);
    await saveCache(c).catch(() => undefined);
    const [mem, ...archByDir] = await Promise.all([
      readContextDir(CONFIG.memoryDir, false),
      ...archiveDirs().map((d) => readContextDir(d, true)),
    ]);
    const memIds = new Set(mem.map((m) => m.id));
    const arch: ContextDoc[] = [];
    const seenArch = new Set<string>();
    for (const doc of archByDir.flat()) {
      if (memIds.has(doc.id) || seenArch.has(doc.id)) continue; // live memory wins; first archive subdir wins over a later duplicate
      seenArch.add(doc.id);
      arch.push(doc);
    }
    return buildCanvasGraph({
      sessions, refs, contexts: [...mem, ...arch], cards: b.cards, running, now,
      memoryDir: CONFIG.memoryDir, tmpDir: tmpdir(),
    });
  })().finally(() => { inflight = null; });
  return inflight;
}
