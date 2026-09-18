import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PackRole, RegistryCatalog, RegistryPack, RegistryRef, RegistrySkill } from '../shared/protocol';
import type { RegistryFile } from './skill-install';

// Reads the DFL Skills registry as a CHILD process, like dfl-sync/dfl-write: the
// owner's DFL token is read here and never enters the WS process or the client.
// Output is one marked line on stdout.

const pexec = promisify(execFile);
export const REGISTRY_RESULT_MARK = 'SKILL_REGISTRY_RESULT:';
const API = process.env.DFL_SKILLS_API ?? 'https://skills.devfellowship.com';
const ROLES: ReadonlySet<string> = new Set<PackRole>(['root', 'required', 'optional', 'suggested']);
const REF_RE = /^[a-zA-Z0-9_.-]{1,100}$/;

export type RegistryCmd = { kind: 'catalog' } | { kind: 'files'; items: RegistryRef[] };
export interface RegistryFilesResult { items: { source: string; slug: string; files: RegistryFile[] }[] }

function credsDir(): string { return process.env.DFL_MCP_DIR ?? join(homedir(), '.dfl-mcp'); }

async function token(): Promise<string> {
  const cred = JSON.parse(await readFile(join(credsDir(), 'credentials.json'), 'utf8'));
  if (!cred.access_token) throw new Error('sem sessão DFL (dfl-auth login)');
  return cred.access_token as string;
}

async function getJson<T>(path: string): Promise<T> {
  const go = async () => fetch(`${API}${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${await token()}` } });
  let res = await go();
  if (res.status === 401) {
    try { await pexec('dfl-auth', ['refresh'], { timeout: 30_000 }); } catch { /* the retry reports */ }
    res = await go();
  }
  if (!res.ok) throw new Error(`registro respondeu ${res.status} em ${path.split('?')[0]}`);
  return (await res.json()) as T;
}

export function validRef(r: RegistryRef): boolean {
  const [owner, repo, extra] = String(r?.source ?? '').split('/');
  return !!owner && !!repo && extra === undefined && REF_RE.test(owner) && REF_RE.test(repo) && REF_RE.test(String(r?.slug ?? ''));
}

function skillPath(r: RegistryRef, suffix = ''): string {
  const [owner, repo] = r.source.split('/');
  return `/api/v1/skills/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(r.slug)}${suffix}`;
}

type Raw = Record<string, unknown>;
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function adaptSkill(raw: Raw): RegistrySkill {
  return {
    source: str(raw.source),
    slug: str(raw.skill) || str(raw.slug),
    name: str(raw.name) || str(raw.skill),
    description: str(raw.description),
    author: typeof raw.author === 'string' && raw.author ? raw.author : null,
    tags: strs(raw.tags),
    categories: strs(raw.categories),
    visibility: str(raw.visibility, 'public'),
  };
}

export function adaptPack(raw: Raw): RegistryPack {
  const source = str(raw.source);
  const members = (Array.isArray(raw.members) ? (raw.members as Raw[]) : [])
    .map((m, i) => ({ m, i, ord: typeof m.ordinal === 'number' ? m.ordinal : i }))
    .sort((a, b) => a.ord - b.ord)
    .map(({ m }) => ({
      source: str(m.source, source),
      slug: str(m.slug),
      role: (ROLES.has(str(m.role)) ? str(m.role) : 'suggested') as PackRole,
      published: m.status === 'in_catalogue',
    }))
    .filter((m) => m.slug);
  return { source, slug: str(raw.pack), name: str(raw.name) || str(raw.pack), description: str(raw.description), root: str(raw.root), members };
}

async function catalog(): Promise<RegistryCatalog> {
  const [s, p] = await Promise.all([
    getJson<{ skills?: Raw[] }>('/api/v1/skills'),
    getJson<{ packs?: Raw[] }>('/api/v1/packs'),
  ]);
  return {
    skills: (s.skills ?? []).map(adaptSkill).filter((x) => x.slug && x.source),
    packs: (p.packs ?? []).map(adaptPack).filter((x) => x.slug && x.source),
    fetchedAt: Date.now(),
  };
}

async function files(items: RegistryRef[]): Promise<RegistryFilesResult> {
  const out: RegistryFilesResult['items'] = [];
  for (const r of items) {
    if (!validRef(r)) throw new Error('referência inválida');
    const body = await getJson<{ files?: RegistryFile[] }>(skillPath(r, '/content'));
    out.push({ source: r.source, slug: r.slug, files: body.files ?? [] });
  }
  return { items: out };
}

async function main() {
  const cmd = JSON.parse(process.argv[2] ?? '{}') as RegistryCmd;
  const result = cmd.kind === 'catalog' ? await catalog() : cmd.kind === 'files' ? await files(cmd.items) : null;
  if (!result) throw new Error('comando desconhecido');
  process.stdout.write(`${REGISTRY_RESULT_MARK}${JSON.stringify(result)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { process.stderr.write(`skill-registry falhou: ${e?.message ?? e}\n`); process.exit(1); });
}
