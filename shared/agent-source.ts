import type { AgentSource } from './protocol';

// GitHub's own limits: owner up to 39 chars of [A-Za-z0-9-], repo up to 100 of [A-Za-z0-9._-].
const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const SEGMENT_RE = /^[A-Za-z0-9._-]{1,100}$/;
export const MAX_SOURCE_PATH = 200;

export type SourceValidation = { ok: true; source: AgentSource } | { ok: false; error: string };

// The repo is "owner/name"; the path is a folder relative to the repo root, '' = the
// root itself. Every segment is a plain name: no `..`, no `.`, no absolute path,
// no backslash, so the joined path can only name something inside the clone.
export function validateAgentSource(raw: unknown): SourceValidation {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'repositório inválido' };
  const r = raw as Record<string, unknown>;
  const repo = typeof r.repo === 'string' ? r.repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '') : '';
  const [owner, name, ...extra] = repo.split('/');
  if (extra.length || !owner || !name || !OWNER_RE.test(owner) || !REPO_RE.test(name) || name === '.' || name === '..') {
    return { ok: false, error: 'repositório inválido (use dono/nome)' };
  }
  const rawPath = typeof r.path === 'string' ? r.path.trim() : '';
  if (rawPath.length > MAX_SOURCE_PATH) return { ok: false, error: `pasta passa de ${MAX_SOURCE_PATH} caracteres` };
  const segments = rawPath.split('/').filter((s) => s !== '');
  if (segments.some((s) => !SEGMENT_RE.test(s) || s === '.' || s === '..')) return { ok: false, error: 'pasta inválida' };
  return { ok: true, source: { repo: `${owner}/${name}`, path: segments.join('/') } };
}

export function sameSource(a: AgentSource | undefined, b: AgentSource | undefined): boolean {
  return a?.repo === b?.repo && a?.path === b?.path;
}
