import { copyFile, lstat, mkdir, readdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { sanitizeMcp, type ClaudeImportResult, type ClaudeImportScan, type ImportKind } from '../shared/claude-import';

const MAX_FILES = 5000;
const MAX_DEPTH = 8;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SKIP_NAMES = /^(\.env.*|.*\.(pem|key|p12|pfx)|id_(rsa|ed25519|ecdsa)|credentials.*|\.credentials.*|.*token.*|settings\.json|\.git|node_modules)$/i;

export function expandHome(p: string, home = homedir()): string {
  const t = p.trim();
  if (t === '~' || t === '$HOME') return home;
  if (t.startsWith('~/')) return join(home, t.slice(2));
  if (t.startsWith('$HOME/')) return join(home, t.slice(6));
  return t;
}

// Real-path containment: `child` must be `root` itself or live under it once both
// are resolved, so a `..` or a symlink cannot reach outside.
export async function isInside(root: string, child: string): Promise<boolean> {
  try {
    const [r, c] = await Promise.all([realpath(root), realpath(child)]);
    return c === r || c.startsWith(r + sep);
  } catch {
    return false;
  }
}

export interface FileEntry { rel: string; abs: string; size: number }

// Regular files only. A symlink anywhere (file or directory) is skipped, never followed.
export async function walkFiles(root: string, rel = '', depth = 0, acc: FileEntry[] = []): Promise<FileEntry[]> {
  if (depth > MAX_DEPTH || acc.length >= MAX_FILES) return acc;
  const dir = join(root, rel);
  let names: string[];
  try { names = await readdir(dir); } catch { return acc; }
  for (const name of names) {
    if (SKIP_NAMES.test(name)) continue;
    const abs = join(dir, name);
    const st = await lstat(abs).catch(() => null);
    if (!st || st.isSymbolicLink()) continue;
    const r = rel ? join(rel, name) : name;
    if (st.isDirectory()) await walkFiles(root, r, depth + 1, acc);
    else if (st.isFile() && st.size <= MAX_FILE_BYTES && acc.length < MAX_FILES) acc.push({ rel: r, abs, size: st.size });
  }
  return acc;
}

async function exists(p: string): Promise<boolean> {
  return lstat(p).then(() => true, () => false);
}

interface Source { dir: string; home: string; claudeJson: string; mem: string }

export async function resolveSource(input: string | undefined, target = homedir()): Promise<{ src: Source } | { reason: NonNullable<ClaudeImportScan['reason']>; dir: string }> {
  const raw = input?.trim() ? expandHome(input, target) : join(target, '.claude');
  if (raw.includes('\0') || !isAbsolute(raw)) return { reason: 'invalid', dir: raw };
  const dir = resolve(raw);
  const st = await lstat(dir).catch((e: NodeJS.ErrnoException) => e);
  if (st instanceof Error) return { reason: st.code === 'ENOENT' ? 'not-found' : 'unreadable', dir };
  if (!st.isDirectory() && !st.isSymbolicLink()) return { reason: 'invalid', dir };
  const real = await realpath(dir).catch(() => null);
  if (!real) return { reason: 'unreadable', dir };
  if (!(await readdir(real).then(() => true, () => false))) return { reason: 'unreadable', dir };
  const targetClaude = await realpath(join(target, '.claude')).catch(() => null);
  if (targetClaude && real === targetClaude) return { reason: 'same-as-target', dir };
  const home = dirname(real);
  return { src: { dir: real, home, claudeJson: join(home, '.claude.json'), mem: join(home, '.claude-mem') } };
}

async function readJson(p: string): Promise<Record<string, any> | null> {
  try {
    const st = await lstat(p);
    if (!st.isFile() || st.size > 20 * 1024 * 1024) return null;
    const v = JSON.parse(await readFile(p, 'utf8'));
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

async function sourceMcps(src: Source): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const cfg = await readJson(src.claudeJson);
  const add = (m: unknown) => {
    if (!m || typeof m !== 'object') return;
    for (const [k, v] of Object.entries(m)) if (!(k in out)) out[k] = v;
  };
  add(cfg?.mcpServers);
  for (const p of Object.values(cfg?.projects ?? {})) add((p as any)?.mcpServers);
  add((await readJson(join(src.home, '.mcp.json')))?.mcpServers);
  return out;
}

async function skillNames(dir: string): Promise<string[]> {
  const root = join(dir, 'skills');
  const names = await readdir(root).catch(() => [] as string[]);
  const ok: string[] = [];
  for (const n of names) {
    if (n.startsWith('.')) continue;
    const st = await lstat(join(root, n, 'SKILL.md')).catch(() => null);
    const d = await lstat(join(root, n)).catch(() => null);
    if (d?.isDirectory() && st?.isFile()) ok.push(n);
  }
  return ok.sort();
}

interface MemoryUnit { label: string; srcRoot: string; destRoot: string; files: FileEntry[] }

async function memoryUnits(src: Source, target: string): Promise<MemoryUnit[]> {
  const units: MemoryUnit[] = [];
  const claudeMd = join(src.dir, 'CLAUDE.md');
  const st = await lstat(claudeMd).catch(() => null);
  if (st?.isFile()) units.push({ label: 'CLAUDE.md', srcRoot: src.dir, destRoot: join(target, '.claude'), files: [{ rel: 'CLAUDE.md', abs: claudeMd, size: st.size }] });
  const projects = await readdir(join(src.dir, 'projects')).catch(() => [] as string[]);
  const files: FileEntry[] = [];
  for (const p of projects) {
    const mem = join(src.dir, 'projects', p, 'memory');
    if (!(await lstat(mem).then((s) => s.isDirectory(), () => false))) continue;
    for (const f of await walkFiles(mem)) files.push({ ...f, rel: join('projects', p, 'memory', f.rel) });
  }
  if (files.length) units.push({ label: 'projects/*/memory', srcRoot: src.dir, destRoot: join(target, '.claude'), files });
  if (await lstat(src.mem).then((s) => s.isDirectory(), () => false)) {
    const dbs = (await walkFiles(src.mem)).filter((f) => !f.rel.includes(sep) && /\.(db|sqlite3?)$/i.test(f.rel));
    if (dbs.length) units.push({ label: '.claude-mem', srcRoot: src.mem, destRoot: join(target, '.claude-mem'), files: dbs });
  }
  return units;
}

async function fresh(unit: MemoryUnit): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  for (const f of unit.files) if (!(await exists(join(unit.destRoot, f.rel)))) out.push(f);
  return out;
}

export async function scanClaudeImport(input?: string, target = homedir()): Promise<ClaudeImportScan> {
  const r = await resolveSource(input, target);
  const empty = (source: string, reason?: ClaudeImportScan['reason']): ClaudeImportScan => ({ source, found: false, reason, skills: [], mcps: [], memory: [] });
  if ('reason' in r) {
    if (r.reason !== 'same-as-target') return empty(r.dir, r.reason);
    return { ...(await scanSource(await resolveOwn(target), target)), source: r.dir, reason: 'same-as-target' };
  }
  return scanSource(r.src, target);
}

async function resolveOwn(target: string): Promise<Source> {
  const dir = join(target, '.claude');
  return { dir, home: target, claudeJson: join(target, '.claude.json'), mem: join(target, '.claude-mem') };
}

async function scanSource(src: Source, target: string): Promise<ClaudeImportScan> {
  const names = await skillNames(src.dir);
  const skills = await Promise.all(names.map(async (name) => ({ name, exists: await exists(join(target, '.claude', 'skills', name)) })));
  const have = (await readJson(join(target, '.claude.json')))?.mcpServers ?? {};
  const mcps = Object.entries(await sourceMcps(src)).flatMap(([name, v]) => {
    const s = sanitizeMcp(v);
    return s ? [{ name, exists: name in have, needsFill: s.needsFill }] : [];
  });
  const memory = await Promise.all((await memoryUnits(src, target)).map(async (u) => {
    const todo = await fresh(u);
    return { label: u.label, files: todo.length, bytes: todo.reduce((n, f) => n + f.size, 0), exists: todo.length === 0 };
  }));
  return { source: src.dir, found: true, skills, mcps, memory };
}

async function copyOne(srcRoot: string, rel: string, destRoot: string): Promise<boolean> {
  const from = join(srcRoot, rel);
  const to = join(destRoot, rel);
  if (!(await isInside(srcRoot, from))) return false;
  const st = await lstat(from);
  if (!st.isFile()) return false;
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to, 1);
  return true;
}

export async function applyClaudeImport(input: string | undefined, kinds: readonly ImportKind[], target = homedir()): Promise<ClaudeImportResult> {
  const result: ClaudeImportResult = { copied: { skills: [], mcps: [], memory: [] }, skipped: [], needsFill: [], errors: [] };
  const r = await resolveSource(input, target);
  if ('reason' in r) { result.errors.push(r.reason === 'same-as-target' ? 'a origem é o próprio ~/.claude do Deck' : `origem inválida (${r.reason})`); return result; }
  const src = r.src;

  if (kinds.includes('skills')) {
    for (const name of await skillNames(src.dir)) {
      const dest = join(target, '.claude', 'skills', name);
      if (await exists(dest)) { result.skipped.push(`skill ${name}`); continue; }
      const srcSkill = join(src.dir, 'skills', name);
      try {
        for (const f of await walkFiles(srcSkill)) await copyOne(srcSkill, f.rel, dest);
        result.copied.skills.push(name);
      } catch (e) { result.errors.push(`skill ${name}: ${(e as Error).message}`); }
    }
  }

  if (kinds.includes('mcps')) await importMcps(src, target, result);

  if (kinds.includes('memory')) {
    for (const u of await memoryUnits(src, target)) {
      let n = 0;
      for (const f of u.files) {
        if (await exists(join(u.destRoot, f.rel))) { result.skipped.push(`${u.label}: ${f.rel}`); continue; }
        try { if (await copyOne(u.srcRoot, f.rel, u.destRoot)) n++; } catch (e) { result.errors.push(`${f.rel}: ${(e as Error).message}`); }
      }
      if (n) result.copied.memory.push(`${u.label} (${n})`);
    }
  }
  return result;
}

async function importMcps(src: Source, target: string, result: ClaudeImportResult): Promise<void> {
  const found = await sourceMcps(src);
  const file = join(target, '.claude.json');
  const cfg = (await readJson(file)) ?? {};
  const servers: Record<string, unknown> = { ...(cfg.mcpServers ?? {}) };
  for (const [name, v] of Object.entries(found)) {
    if (name in servers) { result.skipped.push(`mcp ${name}`); continue; }
    const s = sanitizeMcp(v);
    if (!s) continue;
    servers[name] = s.server;
    result.copied.mcps.push(name);
    if (s.needsFill.length) result.needsFill.push({ mcp: name, keys: s.needsFill });
  }
  if (!result.copied.mcps.length) return;
  try {
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify({ ...cfg, mcpServers: servers }, null, 2), { mode: 0o600 });
    await rename(tmp, file);
  } catch (e) {
    result.copied.mcps = [];
    result.needsFill = [];
    result.errors.push(`mcps: ${(e as Error).message}`);
  }
}

