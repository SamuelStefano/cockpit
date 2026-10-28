import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { MAX_VERSIONS_PER_ITEM, VERSION_ID_RE, type VersionKind, type VersionMeta } from '../../shared/versions';

const ITEM_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;

interface SnapshotFile { v: 1; ts: number; sha: string; deleted: boolean; note?: string; content: string }

export function versionsRoot(): string {
  return join(homedir(), '.deck-agent', 'versions');
}

function itemDir(kind: VersionKind, id: string): string | null {
  if ((kind !== 'agent' && kind !== 'skill') || !ITEM_ID_RE.test(id)) return null;
  return join(versionsRoot(), kind, id);
}

let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

async function names(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((n) => n.endsWith('.json') && VERSION_ID_RE.test(n.slice(0, -5))).map((n) => n.slice(0, -5)).sort();
  } catch { return []; }
}

async function load(dir: string, version: string): Promise<SnapshotFile | null> {
  try {
    const s = JSON.parse(await readFile(join(dir, `${version}.json`), 'utf8')) as SnapshotFile;
    return s && s.v === 1 && typeof s.content === 'string' ? s : null;
  } catch { return null; }
}

const shaOf = (content: string, deleted: boolean) => createHash('sha256').update(deleted ? '\0deleted' : content).digest('hex');

// Versioning must never break the save it observes: any failure is swallowed.
export function recordSnapshot(kind: VersionKind, id: string, content: string | null, note?: string): Promise<string | null> {
  const dir = itemDir(kind, id);
  if (!dir) return Promise.resolve(null);
  return serial(async () => {
    try {
      const deleted = content === null;
      const body = content ?? '';
      const sha = shaOf(body, deleted);
      const existing = await names(dir);
      const last = existing.length ? await load(dir, existing[existing.length - 1]) : null;
      if (last && last.sha === sha) return null;
      await mkdir(dir, { recursive: true, mode: 0o700 });
      let ts = Date.now();
      const lastTs = existing.length ? Number(existing[existing.length - 1].slice(0, 13)) : 0;
      if (ts <= lastTs) ts = lastTs + 1;
      const version = `${String(ts).padStart(13, '0')}-${sha.slice(0, 8)}`;
      const file: SnapshotFile = { v: 1, ts, sha, deleted, ...(note ? { note } : {}), content: body };
      await writeFile(join(dir, `${version}.json`), JSON.stringify(file), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      const all = [...existing, version];
      for (const old of all.slice(0, Math.max(0, all.length - MAX_VERSIONS_PER_ITEM))) await rm(join(dir, `${old}.json`), { force: true });
      return version;
    } catch { return null; }
  });
}

export async function listVersions(kind: VersionKind, id: string): Promise<VersionMeta[]> {
  const dir = itemDir(kind, id);
  if (!dir) return [];
  const out: VersionMeta[] = [];
  for (const version of (await names(dir)).reverse()) {
    const s = await load(dir, version);
    if (s) out.push({ version, ts: s.ts, bytes: Buffer.byteLength(s.content), deleted: s.deleted, ...(s.note ? { note: s.note } : {}) });
  }
  return out;
}

export async function readVersion(kind: VersionKind, id: string, version: string): Promise<{ content: string; deleted: boolean } | null> {
  const dir = itemDir(kind, id);
  if (!dir || !VERSION_ID_RE.test(version)) return null;
  const s = await load(dir, version);
  return s ? { content: s.content, deleted: s.deleted } : null;
}
