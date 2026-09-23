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
function archiveDir(): string {
  return process.env.COCKPIT_MEMORY_ARCHIVE ?? join(homedir(), '.claude', 'memory-archive', 'handoffs');
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
    const [mem, arch] = await Promise.all([readContextDir(CONFIG.memoryDir, false), readContextDir(archiveDir(), true)]);
    const memIds = new Set(mem.map((m) => m.id));
    return buildCanvasGraph({ sessions, refs, contexts: [...mem, ...arch.filter((a) => !memIds.has(a.id))], cards: b.cards });
  })().finally(() => { inflight = null; });
  return inflight;
}
