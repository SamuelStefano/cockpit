import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { RegistryCatalog, RegistryRef } from '../shared/protocol';
import { CONFIG } from './config';
import { REGISTRY_RESULT_MARK, validRef, type RegistryCmd, type RegistryFilesResult } from './skill-registry';
import { SKILL_SLUG_RE, skillExists, verifySkillFiles, writeSkillDir } from './skill-install';

const pexec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const CATALOG_TTL_MS = 10 * 60_000;
export const MAX_INSTALL_ITEMS = 40;

async function run<T>(cmd: RegistryCmd): Promise<T> {
  const tsx = join(here, '..', 'node_modules', '.bin', 'tsx');
  try {
    const { stdout } = await pexec(tsx, [join(here, 'skill-registry.ts'), JSON.stringify(cmd)], { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
    const line = stdout.split('\n').find((l) => l.startsWith(REGISTRY_RESULT_MARK));
    if (!line) throw new Error('registro não retornou resultado');
    return JSON.parse(line.slice(REGISTRY_RESULT_MARK.length)) as T;
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    throw new Error(err.stderr?.trim().split('\n').pop() || err.message || 'falha no registro');
  }
}

let cache: RegistryCatalog | null = null;

export async function getRegistryCatalog(refresh = false): Promise<RegistryCatalog> {
  if (!refresh && cache && Date.now() - cache.fetchedAt < CATALOG_TTL_MS) return cache;
  cache = await run<RegistryCatalog>({ kind: 'catalog' });
  return cache;
}

export interface InstallOutcome { installed: string[]; skipped: string[]; failed: { slug: string; error: string }[] }

// Installs only what is missing: an existing skill dir is skipped, never replaced.
export async function installFromRegistry(items: RegistryRef[]): Promise<InstallOutcome> {
  const out: InstallOutcome = { installed: [], skipped: [], failed: [] };
  const wanted: RegistryRef[] = [];
  const seen = new Set<string>();
  for (const r of items.slice(0, MAX_INSTALL_ITEMS)) {
    if (!validRef(r) || !SKILL_SLUG_RE.test(r.slug)) { out.failed.push({ slug: String(r?.slug ?? '?'), error: 'referência inválida' }); continue; }
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    if (await skillExists(CONFIG.skillsDir, r.slug)) out.skipped.push(r.slug);
    else wanted.push({ source: r.source, slug: r.slug });
  }
  if (wanted.length === 0) return out;
  const fetched = await run<RegistryFilesResult>({ kind: 'files', items: wanted });
  for (const item of fetched.items) {
    const v = verifySkillFiles(item.files);
    if (!v.ok) { out.failed.push({ slug: item.slug, error: v.error }); continue; }
    const w = await writeSkillDir(CONFIG.skillsDir, item.slug, v.files);
    if (w.ok) out.installed.push(item.slug);
    else if (w.error === 'já instalada') out.skipped.push(item.slug);
    else out.failed.push({ slug: item.slug, error: w.error });
  }
  return out;
}
