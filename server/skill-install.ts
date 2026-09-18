import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

// Writes a registry skill directory into the agent's skills dir. Registry content
// is DATA: every path is re-validated here and every file is checked against the
// sha256 the registry recorded, so a tampered or truncated payload never lands.

export const SKILL_SLUG_RE = /^[a-zA-Z0-9_-]{1,80}$/;
const SEGMENT_RE = /^[a-zA-Z0-9._-]{1,120}$/;
export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_SKILL_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 200;

export interface RegistryFile {
  path: string;
  sha256: string;
  encoding: string;
  content: string;
}

export interface VerifiedFile { path: string; bytes: Buffer }

export function isSafeRelativePath(p: string): boolean {
  if (typeof p !== 'string' || !p || p.length > 400) return false;
  if (p.startsWith('/') || p.includes('\\')) return false;
  const parts = p.split('/');
  return parts.every((seg) => SEGMENT_RE.test(seg) && seg !== '.' && seg !== '..');
}

function decode(f: RegistryFile): Buffer | null {
  if (typeof f.content !== 'string') return null;
  const enc = (f.encoding || 'utf-8').toLowerCase();
  if (enc === 'base64') return Buffer.from(f.content, 'base64');
  if (enc === 'utf-8' || enc === 'utf8') return Buffer.from(f.content, 'utf8');
  return null;
}

export function verifySkillFiles(files: RegistryFile[]): { ok: true; files: VerifiedFile[] } | { ok: false; error: string } {
  if (!Array.isArray(files) || files.length === 0) return { ok: false, error: 'skill sem arquivos' };
  if (files.length > MAX_FILES) return { ok: false, error: 'arquivos demais' };
  const seen = new Set<string>();
  const out: VerifiedFile[] = [];
  let total = 0;
  for (const f of files) {
    if (!isSafeRelativePath(f?.path)) return { ok: false, error: `caminho inválido: ${String(f?.path).slice(0, 80)}` };
    if (seen.has(f.path)) return { ok: false, error: `arquivo duplicado: ${f.path}` };
    seen.add(f.path);
    const bytes = decode(f);
    if (!bytes) return { ok: false, error: `encoding desconhecido em ${f.path}` };
    if (bytes.length > MAX_FILE_BYTES) return { ok: false, error: `arquivo grande demais: ${f.path}` };
    total += bytes.length;
    if (total > MAX_SKILL_BYTES) return { ok: false, error: 'skill grande demais' };
    if (createHash('sha256').update(bytes).digest('hex') !== f.sha256) return { ok: false, error: `hash não confere: ${f.path}` };
    out.push({ path: f.path, bytes });
  }
  if (!seen.has('SKILL.md')) return { ok: false, error: 'skill sem SKILL.md' };
  return { ok: true, files: out };
}

export async function skillExists(skillsDir: string, slug: string): Promise<boolean> {
  if (!SKILL_SLUG_RE.test(slug)) return false;
  try { await stat(join(skillsDir, slug)); return true; } catch { return false; }
}

// Staged in a sibling temp dir and renamed into place, so a half-written skill is
// never visible to the agent. Never overwrites: an existing dir may carry local edits.
export async function writeSkillDir(skillsDir: string, slug: string, files: VerifiedFile[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!SKILL_SLUG_RE.test(slug)) return { ok: false, error: 'slug inválido' };
  const root = resolve(skillsDir);
  const target = resolve(join(root, slug));
  if (!target.startsWith(root + sep)) return { ok: false, error: 'caminho inválido' };
  if (await skillExists(root, slug)) return { ok: false, error: 'já instalada' };
  const tmp = resolve(join(root, `.installing-${slug}-${randomUUID()}`));
  try {
    for (const f of files) {
      const full = resolve(join(tmp, f.path));
      if (!full.startsWith(tmp + sep)) throw new Error('caminho inválido');
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, f.bytes);
    }
    await rename(tmp, target);
    return { ok: true };
  } catch (e) {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
    return { ok: false, error: (e as Error).message || 'falha ao gravar' };
  }
}
