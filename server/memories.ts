import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import type { Memory, MemoryInput } from '../shared/protocol';
import { MAX_MEMORY_BODY_BYTES } from '../shared/memory';
import { withFileLockAsync } from './ws/file-lock';
import { listContexts, readContext } from './contexts';
import { CONFIG } from './config';

export const MAX_MEMORIES = 200;
const ID_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const MAX_AGENTS = 40;

interface StoredMemory extends Memory {
  diskMtime?: number;
  deleted?: boolean;
}
interface Store { version: 1; items: StoredMemory[] }

export function memoriesFile(): string {
  return process.env.COCKPIT_MEMORIES ?? join(homedir(), '.cockpit', 'memories.json');
}

function parseStore(raw: string): Store {
  try {
    const j = JSON.parse(raw);
    const items = Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : [];
    return { version: 1, items: items.filter((m: StoredMemory) => m && typeof m.id === 'string' && typeof m.body === 'string') };
  } catch { return { version: 1, items: [] }; }
}

async function readStore(): Promise<Store> {
  try { return parseStore(await readFile(memoriesFile(), 'utf8')); } catch { return { version: 1, items: [] }; }
}

async function writeStore(store: Store): Promise<void> {
  const file = memoriesFile();
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2) + '\n', 'utf8');
  await rename(tmp, file);
}

let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const locked = () => withFileLockAsync(memoriesFile(), fn);
  const next = chain.then(locked, locked);
  chain = next.catch(() => {});
  return next;
}

const diskId = (slug: string) => `ctx-${slug}`;

// The agent's own memory files (what /contextos used to list) become memories the
// first time they are seen; the .md stays untouched. Linked by id, so an agent
// rewrite later refreshes title and body but never the readers the user chose.
async function syncFromDisk(store: Store): Promise<boolean> {
  let changed = false;
  for (const meta of await listContexts()) {
    const id = diskId(meta.id);
    const cur = store.items.find((m) => m.id === id);
    if (cur?.deleted) continue;
    if (cur && (cur.diskMtime ?? 0) >= meta.mtime) continue;
    const doc = await readContext(meta.id);
    if (!doc) continue;
    if (cur) {
      cur.title = doc.title; cur.body = doc.body; cur.updatedAt = meta.mtime; cur.diskMtime = meta.mtime; cur.updatedBy = 'agent';
    } else {
      store.items.push({ id, title: doc.title, body: doc.body, agents: [], updatedAt: meta.mtime, updatedBy: 'agent', fromDisk: true, diskMtime: meta.mtime });
    }
    changed = true;
  }
  return changed;
}

function publicView(m: StoredMemory): Memory {
  const { diskMtime: _d, deleted: _x, ...rest } = m;
  return rest;
}

export function getMemories(): Promise<Memory[]> {
  return serialize(async () => {
    const store = await readStore();
    if (await syncFromDisk(store)) await writeStore(store);
    return store.items.filter((m) => !m.deleted).map(publicView).sort((a, b) => b.updatedAt - a.updatedAt);
  });
}

export async function readMemoriesSafe(): Promise<Memory[]> {
  try { return (await readStore()).items.filter((m) => !m.deleted).map(publicView); } catch { return []; }
}

export type MemoryInputResult = { ok: true; input: Required<Pick<MemoryInput, 'title' | 'body' | 'agents'>> & { id?: string; fileName?: string } } | { ok: false; error: string };

export function validateMemoryInput(raw: unknown): MemoryInputResult {
  const m = raw as Partial<MemoryInput> | null;
  if (!m || typeof m !== 'object') return { ok: false, error: 'memória inválida' };
  if (m.id !== undefined && (typeof m.id !== 'string' || !ID_RE.test(m.id))) return { ok: false, error: 'memória inválida' };
  const title = typeof m.title === 'string' ? m.title.replace(/[\r\n]+/g, ' ').trim().slice(0, 120) : '';
  if (!title) return { ok: false, error: 'dê um título à memória' };
  if (typeof m.body !== 'string') return { ok: false, error: 'memória inválida' };
  if (Buffer.byteLength(m.body) > MAX_MEMORY_BODY_BYTES) return { ok: false, error: 'memória grande demais' };
  const agents = Array.isArray(m.agents) ? [...new Set(m.agents.filter((a): a is string => typeof a === 'string' && ID_RE.test(a)))].slice(0, MAX_AGENTS) : [];
  const fileName = typeof m.fileName === 'string' && m.fileName ? m.fileName.replace(/[\r\n/\\]/g, '_').slice(0, 120) : undefined;
  return { ok: true, input: { id: m.id, title, body: m.body, agents, ...(fileName ? { fileName } : {}) } };
}

async function writeBackToDisk(slug: string, title: string, body: string): Promise<number | undefined> {
  const dir = resolve(CONFIG.memoryDir);
  const full = resolve(join(dir, `${slug}.md`));
  if (!full.startsWith(dir + '/')) return undefined;
  let head = '';
  try {
    const raw = await readFile(full, 'utf8');
    const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(raw);
    head = m ? m[0] : '';
  } catch { return undefined; }
  if (head) head = head.replace(/^(name:).*$/m, `$1 ${title}`);
  try {
    await writeFile(full, `${head}${head ? '\n' : ''}${body}`, 'utf8');
    return (await stat(full)).mtimeMs;
  } catch { return undefined; }
}

export function saveMemory(input: NonNullable<Extract<MemoryInputResult, { ok: true }>['input']>, by = 'user', now = Date.now()): Promise<{ ok: true; items: Memory[] } | { ok: false; error: string }> {
  return serialize(async () => {
    const store = await readStore();
    await syncFromDisk(store);
    const id = input.id ?? `m-${randomBytes(5).toString('hex')}`;
    const i = store.items.findIndex((m) => m.id === id);
    if (i < 0 && store.items.filter((m) => !m.deleted).length >= MAX_MEMORIES) return { ok: false as const, error: `limite de ${MAX_MEMORIES} memórias` };
    const prev = i >= 0 ? store.items[i] : undefined;
    const next: StoredMemory = {
      ...prev, id, title: input.title, body: input.body, agents: input.agents, updatedAt: now, updatedBy: by, deleted: undefined,
      ...(input.fileName ? { fileName: input.fileName } : {}),
    };
    if (!next.deleted) delete next.deleted;
    if (prev?.fromDisk && id.startsWith('ctx-')) {
      const mtime = await writeBackToDisk(id.slice(4), input.title, input.body);
      if (mtime !== undefined) next.diskMtime = mtime;
    }
    if (i >= 0) store.items[i] = next; else store.items.push(next);
    await writeStore(store);
    return { ok: true as const, items: store.items.filter((m) => !m.deleted).map(publicView).sort((a, b) => b.updatedAt - a.updatedAt) };
  });
}

export function deleteMemory(id: string): Promise<Memory[]> {
  return serialize(async () => {
    const store = await readStore();
    const cur = store.items.find((m) => m.id === id);
    if (cur) {
      if (cur.fromDisk) cur.deleted = true;
      else store.items = store.items.filter((m) => m.id !== id);
      await writeStore(store);
    }
    return store.items.filter((m) => !m.deleted).map(publicView).sort((a, b) => b.updatedAt - a.updatedAt);
  });
}
