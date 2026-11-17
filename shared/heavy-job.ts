export type HeavyStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface HeavyJob {
  id: string;
  repo: string;
  branch: string;
  dir?: string;
  command: string;
  requestedBy: string;
  status: HeavyStatus;
  exitCode?: number;
  tail: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
}

export interface ExecutorState {
  configured: boolean;
  label: string;
  online: boolean | null;
  checkedAt?: number;
  stalledSince?: number;
}

export interface JobInput { repo: string; branch: string; dir?: string; command: string }

export const HEAVY_LIMITS = { repo: 100, branch: 200, dir: 200, command: 2000, tail: 4000, keep: 100 } as const;
export const HUMAN = 'human';

const REPO_RE = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)?$/;
const PATH_RE = /^[A-Za-z0-9._/-]+$/;

export const isActive = (j: Pick<HeavyJob, 'status'>): boolean => j.status === 'queued' || j.status === 'running';

export type JobValidation = { ok: true; input: JobInput } | { ok: false; error: string };

function pathError(value: string, what: string, max: number): string | null {
  if (value.length > max) return `${what} passa de ${max} caracteres`;
  if (!PATH_RE.test(value) || value.includes('..') || value.startsWith('-')) return `${what} inválido`;
  return null;
}

export function validateJobInput(raw: unknown): JobValidation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const repo = typeof r.repo === 'string' ? r.repo.trim() : '';
  if (!repo) return { ok: false, error: 'informe o repositório' };
  if (repo.length > HEAVY_LIMITS.repo || !REPO_RE.test(repo) || repo.includes('..')) return { ok: false, error: 'repositório inválido' };
  const branch = typeof r.branch === 'string' ? r.branch.trim() : '';
  if (!branch) return { ok: false, error: 'informe a branch' };
  const branchErr = pathError(branch, 'branch', HEAVY_LIMITS.branch);
  if (branchErr) return { ok: false, error: branchErr };
  let dir: string | undefined;
  if (r.dir !== undefined && r.dir !== null && r.dir !== '') {
    if (typeof r.dir !== 'string') return { ok: false, error: 'pasta inválida' };
    dir = r.dir.trim();
    const dirErr = pathError(dir, 'pasta', HEAVY_LIMITS.dir);
    if (dirErr) return { ok: false, error: dirErr };
    if (dir.startsWith('/')) return { ok: false, error: 'a pasta deve ser relativa' };
  }
  const command = typeof r.command === 'string' ? r.command.trim() : '';
  if (!command) return { ok: false, error: 'informe o comando' };
  if (command.length > HEAVY_LIMITS.command) return { ok: false, error: `o comando passa de ${HEAVY_LIMITS.command} caracteres` };
  if (/[\0\r\n]/.test(command)) return { ok: false, error: 'o comando não pode ter quebra de linha' };
  return { ok: true, input: { repo, branch, ...(dir ? { dir } : {}), command } };
}

// One pass over each element: a substituted value is never scanned again, so a
// command containing "{repo}" stays literal. The result is an argv, never a shell line.
export function buildArgv(template: string[], job: JobInput): string[] {
  const values: Record<string, string> = { repo: job.repo, branch: job.branch, dir: job.dir || '.', command: job.command };
  return template.map((part) => part.replace(/\{(repo|branch|dir|command)\}/g, (_m, k: string) => values[k]));
}

export function appendTail(tail: string, chunk: string): string {
  const all = tail + chunk;
  return all.length > HEAVY_LIMITS.tail ? all.slice(all.length - HEAVY_LIMITS.tail) : all;
}

export function nextJob(jobs: HeavyJob[]): HeavyJob | undefined {
  return jobs.filter((j) => j.status === 'queued').sort((a, b) => a.createdAt - b.createdAt)[0];
}

export function newJob(id: string, input: JobInput, requestedBy: string, now: number): HeavyJob {
  return { id, ...input, requestedBy, status: 'queued', tail: '', createdAt: now };
}

export function startJob(j: HeavyJob, now: number): HeavyJob {
  return { ...j, status: 'running', startedAt: now };
}

export function finishJob(j: HeavyJob, status: 'done' | 'failed' | 'cancelled', now: number, extra: { exitCode?: number; error?: string } = {}): HeavyJob {
  return { ...j, status, endedAt: now, ...(extra.exitCode !== undefined ? { exitCode: extra.exitCode } : {}), ...(extra.error ? { error: extra.error.slice(0, 200) } : {}) };
}

// Set once the oldest queued job has waited `stallMs` with the executor offline;
// cleared as soon as it is online or nothing waits. Held while the stall lasts.
export function stalledSince(jobs: HeavyJob[], online: boolean | null, stallMs: number, now: number, prev?: number): number | undefined {
  if (online !== false) return undefined;
  const oldest = nextJob(jobs);
  if (!oldest) return undefined;
  if (prev !== undefined) return prev;
  return now - oldest.createdAt >= stallMs ? now : undefined;
}

const STATUSES: HeavyStatus[] = ['queued', 'running', 'done', 'failed', 'cancelled'];

export function coerceJob(raw: unknown): HeavyJob | null {
  const r = raw as Partial<HeavyJob> | null;
  if (!r || typeof r.id !== 'string' || typeof r.repo !== 'string' || typeof r.branch !== 'string' || typeof r.command !== 'string') return null;
  if (!STATUSES.includes(r.status as HeavyStatus) || typeof r.createdAt !== 'number') return null;
  return { ...(r as HeavyJob), requestedBy: typeof r.requestedBy === 'string' ? r.requestedBy : HUMAN, tail: typeof r.tail === 'string' ? r.tail : '' };
}

export function jobExitCode(j: Pick<HeavyJob, 'status' | 'exitCode'>): number {
  if (j.status === 'cancelled') return 130;
  if (j.status === 'done') return 0;
  return j.exitCode ?? 1;
}
