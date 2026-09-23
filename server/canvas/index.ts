import { open, readdir, readFile, stat, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
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

function refsFile(): string {
  return process.env.COCKPIT_CANVAS_REFS ?? join(homedir(), '.cockpit', 'canvas-refs.json');
}
// The archive has 3 subdirs (`memory-gc`'s destinations); the "arquivo" toggle
// used to only read `handoffs/` (a handful of files) and silently ignored
// `stale/` and `full/` (the bulk of what gets archived), so most archived
// contexts never showed up (canvas review #11).
function archiveDirs(): string[] {
  const base = process.env.COCKPIT_MEMORY_ARCHIVE ?? join(homedir(), '.claude', 'memory-archive');
  return ['handoffs', 'stale', 'full'].map((d) => join(base, d));
}

type RefsCache = Map<string, SessionRefs & { size: number }>;
let cache: RefsCache | null = null;

async function loadCache(): Promise<RefsCache> {
  if (cache) return cache;
  try {
    const raw = JSON.parse(await readFile(refsFile(), 'utf8')) as Record<string, SessionRefs & { size: number }>;
    cache = new Map(Object.entries(raw));
  } catch {
    cache = new Map();
  }
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

async function saveCache(c: RefsCache): Promise<void> {
  const f = refsFile();
  await mkdir(dirname(f), { recursive: true });
  await writeFile(`${f}.tmp`, JSON.stringify(Object.fromEntries(c)), 'utf8');
  await rename(`${f}.tmp`, f);
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

async function sessionRefs(c: RefsCache, id: string): Promise<SessionRefs | undefined> {
  const path = join(CONFIG.projectsDir, `${id}.jsonl`);
  let size: number;
  try { size = (await stat(path)).size; } catch { return c.get(id); }
  const hit = c.get(id);
  if (hit && hit.size === size && hit.topics) return hit;
  // Shrunk = rewritten (compaction tooling, manual edit): the offset is meaningless.
  // A hit missing `topics` predates that field: bytes already consumed were never
  // scanned for it, so this is a full rescan from 0 rather than a tail resume.
  const refs: SessionRefs = hit && hit.topics && size > hit.size
    ? { contexts: { ...hit.contexts }, cardId: hit.cardId, topics: hit.topics, consumed: hit.consumed }
    : emptyRefs();
  try { await scanTail(path, refs); } catch { return hit; }
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

export function buildCanvas(board?: CanvasBoard): Promise<CanvasGraph> {
  if (inflight) return inflight;
  inflight = (async () => {
    const c = await loadCache();
    const [live, archived, b] = await Promise.all([listSessions(), listArchived(), board ? Promise.resolve(board) : readBoard()]);
    const sessions = [...live.map((meta) => ({ meta, archived: false })), ...archived.map((meta) => ({ meta, archived: true }))];
    const refs = new Map<string, SessionRefs>();
    for (const { meta } of sessions) {
      const r = await sessionRefs(c, meta.id);
      if (r) refs.set(meta.id, r);
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
    return buildCanvasGraph({ sessions, refs, contexts: [...mem, ...arch], cards: b.cards });
  })().finally(() => { inflight = null; });
  return inflight;
}
