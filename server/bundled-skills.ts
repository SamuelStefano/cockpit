import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSafeRelativePath, SKILL_SLUG_RE, MAX_FILES, MAX_FILE_BYTES } from './skill-install';

// Skills shipped inside the repo (bundled-skills/<slug>/). The agent copies them into
// the skills dir on boot so a fresh box can ask the Deck how to set itself up. The
// marker records the hash of what WE wrote: a folder without it, or with edits made
// since, is the user's and is never touched.

export const BUNDLED_MARKER = '.deck-bundled.json';
export const BUNDLED_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'bundled-skills');

interface BundledFile { path: string; bytes: Buffer }
export interface BundledSkill { slug: string; files: BundledFile[]; hash: string }
export interface BundledReport { installed: string[]; updated: string[]; kept: string[] }

export function hashFiles(files: BundledFile[]): string {
  const h = createHash('sha256');
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    h.update(f.path).update('\0').update(createHash('sha256').update(f.bytes).digest()).update('\0');
  }
  return h.digest('hex');
}

async function walk(root: string, rel = ''): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(join(root, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(root, p));
    else if (e.isFile() && e.name !== BUNDLED_MARKER) out.push(p);
  }
  return out;
}

async function readFiles(dir: string): Promise<BundledFile[] | null> {
  let paths: string[];
  try { paths = await walk(dir); } catch { return null; }
  if (paths.length === 0 || paths.length > MAX_FILES || !paths.includes('SKILL.md')) return null;
  const files: BundledFile[] = [];
  for (const path of paths) {
    if (!isSafeRelativePath(path)) return null;
    const bytes = await readFile(join(dir, path));
    if (bytes.length > MAX_FILE_BYTES) return null;
    files.push({ path, bytes });
  }
  return files;
}

export async function loadBundledSkills(srcDir = BUNDLED_DIR): Promise<BundledSkill[]> {
  let entries;
  try { entries = await readdir(srcDir, { withFileTypes: true }); } catch { return []; }
  const out: BundledSkill[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || !SKILL_SLUG_RE.test(e.name)) continue;
    const files = await readFiles(join(srcDir, e.name));
    if (files) out.push({ slug: e.name, files, hash: hashFiles(files) });
  }
  return out;
}

async function readMarker(dir: string): Promise<string | null> {
  try {
    const m = JSON.parse(await readFile(join(dir, BUNDLED_MARKER), 'utf8')) as { hash?: unknown };
    return typeof m.hash === 'string' ? m.hash : null;
  } catch { return null; }
}

async function exists(dir: string): Promise<boolean> {
  try { await readdir(dir); return true; } catch { return false; }
}

async function place(root: string, skill: BundledSkill, replace: boolean): Promise<void> {
  const target = resolve(join(root, skill.slug));
  const tmp = resolve(join(root, `.installing-${skill.slug}-${randomUUID()}`));
  if (!target.startsWith(root + sep)) throw new Error('invalid path');
  try {
    for (const f of skill.files) {
      const full = resolve(join(tmp, f.path));
      if (!full.startsWith(tmp + sep)) throw new Error('invalid path');
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, f.bytes);
    }
    await writeFile(join(tmp, BUNDLED_MARKER), JSON.stringify({ hash: skill.hash }) + '\n');
    if (replace) await rm(target, { recursive: true, force: true });
    await rename(tmp, target);
  } catch (e) {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}

export async function installBundledSkills(skillsDir: string, srcDir = BUNDLED_DIR): Promise<BundledReport> {
  const root = resolve(skillsDir);
  const report: BundledReport = { installed: [], updated: [], kept: [] };
  const skills = await loadBundledSkills(srcDir);
  if (skills.length === 0) return report;
  await mkdir(root, { recursive: true });
  for (const skill of skills) {
    const dir = join(root, skill.slug);
    try {
      if (!(await exists(dir))) { await place(root, skill, false); report.installed.push(skill.slug); continue; }
      const recorded = await readMarker(dir);
      const current = await readFiles(dir);
      if (recorded === null || !current || hashFiles(current) !== recorded) { report.kept.push(skill.slug); continue; }
      if (recorded === skill.hash) continue;
      await place(root, skill, true);
      report.updated.push(skill.slug);
    } catch { report.kept.push(skill.slug); }
  }
  return report;
}

export function ensureBundledSkills(skillsDir: string): void {
  installBundledSkills(skillsDir)
    .then((r) => { if (r.installed.length || r.updated.length) console.log(`[skills] bundled: installed ${r.installed.join(',') || '-'} updated ${r.updated.join(',') || '-'}`); })
    .catch((e) => console.error('[skills] bundled install failed:', (e as Error).message));
}
