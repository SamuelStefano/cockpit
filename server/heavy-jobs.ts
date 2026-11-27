import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TeamBot } from '../shared/protocol';
import {
  HEAVY_LIMITS, HUMAN, appendTail, buildArgv, coerceJob, finishJob, isActive, newJob, nextJob, stalledSince, startJob, validateJobInput,
  type ExecutorState, type HeavyJob,
} from '../shared/heavy-job';
import { withFileLockAsync } from './ws/file-lock';
import { teamFile } from './team-log';
import type { ExecutorConfig, RunHandle, RunHandlers } from './heavy-executor';

export const RETRY_MS = 60_000;
export const FLUSH_MS = 1_000;
const MAX_ACTIVE = 20;

export function heavyJobsFile(): string {
  return process.env.COCKPIT_HEAVY_JOBS ?? join(dirname(teamFile()), 'heavy-jobs.json');
}

export async function getJobs(): Promise<HeavyJob[]> {
  try {
    const j = JSON.parse(await readFile(heavyJobsFile(), 'utf8'));
    return Array.isArray(j) ? j.map(coerceJob).filter((x): x is HeavyJob => x !== null) : [];
  } catch { return []; }
}

async function writeJobs(list: HeavyJob[]): Promise<void> {
  const file = heavyJobsFile();
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, JSON.stringify(list, null, 2) + '\n', 'utf8');
  await rename(tmp, file);
}

let writeChain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const locked = () => withFileLockAsync(heavyJobsFile(), fn);
  const next = writeChain.then(locked, locked);
  writeChain = next.catch(() => {});
  return next;
}

// The newest `keep` jobs, plus any job still waiting or running however old.
function trim(all: HeavyJob[]): HeavyJob[] {
  const sorted = [...all].sort((a, b) => a.createdAt - b.createdAt);
  const recent = new Set(sorted.slice(-HEAVY_LIMITS.keep).map((j) => j.id));
  return sorted.filter((j) => recent.has(j.id) || isActive(j));
}

export function saveJob(j: HeavyJob): Promise<void> {
  return serialize(async () => {
    const all = await getJobs();
    const i = all.findIndex((x) => x.id === j.id);
    if (i >= 0) all[i] = j; else all.push(j);
    await writeJobs(trim(all));
  });
}

// Claims the oldest queued job unless one is already running (this process or the other Deck process).
export function claimNext(now: number): Promise<HeavyJob | null> {
  return serialize(async () => {
    const all = await getJobs();
    if (all.some((j) => j.status === 'running')) return null;
    const next = nextJob(all);
    if (!next) return null;
    const claimed = startJob(next, now);
    await writeJobs(trim(all.map((j) => (j.id === next.id ? claimed : j))));
    return claimed;
  });
}

export function cancelQueued(id: string, now: number): Promise<HeavyJob | null> {
  return serialize(async () => {
    const all = await getJobs();
    const hit = all.find((j) => j.id === id && j.status === 'queued');
    if (!hit) return null;
    const cancelled = finishJob(hit, 'cancelled', now);
    await writeJobs(trim(all.map((j) => (j.id === id ? cancelled : j))));
    return cancelled;
  });
}

export function failInterruptedJobs(now = Date.now()): Promise<boolean> {
  return serialize(async () => {
    const all = await getJobs();
    if (!all.some((j) => j.status === 'running')) return false;
    await writeJobs(all.map((j) => (j.status === 'running' ? finishJob(j, 'failed', now, { error: 'interrompido por reinício' }) : j)));
    return true;
  });
}

export interface HeavyDeps {
  config: () => ExecutorConfig | null;
  probe: (argv: string[]) => Promise<boolean>;
  spawn: (argv: string[], h: RunHandlers) => RunHandle;
  getTeam: () => Promise<TeamBot[]>;
  publish: (executor: ExecutorState, jobs: HeavyJob[]) => void;
  setTimer: (fn: () => void, ms: number) => () => void;
  now: () => number;
  newId: () => string;
}

interface Current { id: string; handle: RunHandle | null; reason?: 'cancel' | 'timeout' }

const view: { online: boolean | null; checkedAt?: number; stalledSince?: number } = { online: null };
let current: Current | null = null;
let pumping = false;
let again = false;
let cancelRetry: (() => void) | null = null;

export function resetHeavyRuntime(): void {
  view.online = null;
  delete view.checkedAt;
  delete view.stalledSince;
  current = null;
  pumping = false;
  again = false;
  cancelRetry?.();
  cancelRetry = null;
}

export async function heavySnapshot(deps: HeavyDeps): Promise<{ executor: ExecutorState; jobs: HeavyJob[] }> {
  const cfg = deps.config();
  const jobs = (await getJobs()).sort((a, b) => b.createdAt - a.createdAt);
  const executor: ExecutorState = cfg
    ? { configured: true, label: cfg.label, online: view.online, ...(view.checkedAt !== undefined ? { checkedAt: view.checkedAt } : {}), ...(view.stalledSince !== undefined ? { stalledSince: view.stalledSince } : {}) }
    : { configured: false, label: '', online: null };
  return { executor, jobs };
}

async function publish(deps: HeavyDeps): Promise<void> {
  const s = await heavySnapshot(deps);
  deps.publish(s.executor, s.jobs);
}

function schedulePump(deps: HeavyDeps): void {
  cancelRetry?.();
  cancelRetry = deps.setTimer(() => { cancelRetry = null; void pump(deps); }, RETRY_MS);
}

async function probeNow(cfg: ExecutorConfig, deps: HeavyDeps): Promise<boolean> {
  const online = await deps.probe(cfg.probe).catch(() => false);
  view.online = online;
  view.checkedAt = deps.now();
  return online;
}

function runJob(job: HeavyJob, cfg: ExecutorConfig, deps: HeavyDeps): Promise<void> {
  return new Promise((resolve) => {
    const cur: Current = { id: job.id, handle: null };
    current = cur;
    let tail = job.tail;
    let cancelFlush: (() => void) | null = null;
    let dirty = false;
    const flush = () => {
      cancelFlush = null;
      if (!dirty) return;
      dirty = false;
      void saveJob({ ...job, tail }).then(() => publish(deps)).catch(() => {});
    };
    const cancelTimeout = deps.setTimer(() => { cur.reason = 'timeout'; cur.handle?.kill(); }, cfg.timeoutMin * 60_000);
    let ended = false;
    const finalize = (code: number | null, spawnError?: string) => {
      if (ended) return;
      ended = true;
      cancelTimeout();
      cancelFlush?.();
      const now = deps.now();
      const base = { ...job, tail };
      let done: HeavyJob;
      if (cur.reason === 'cancel') done = finishJob(base, 'cancelled', now);
      else if (cur.reason === 'timeout') done = finishJob(base, 'failed', now, { error: 'tempo esgotado' });
      else if (code === 0) done = finishJob(base, 'done', now, { exitCode: 0 });
      else if (code === null) done = finishJob(base, 'failed', now, { error: spawnError ?? 'processo encerrado sem código de saída' });
      else done = finishJob(base, 'failed', now, { exitCode: code });
      void saveJob(done).catch(() => {}).then(() => { current = null; return publish(deps); }).catch(() => {}).then(() => resolve());
    };
    try {
      cur.handle = deps.spawn(buildArgv(cfg.run, job), {
        onData: (chunk) => {
          tail = appendTail(tail, chunk);
          dirty = true;
          if (!cancelFlush) cancelFlush = deps.setTimer(flush, FLUSH_MS);
        },
        onExit: finalize,
      });
    } catch (e) {
      finalize(null, e instanceof Error ? e.message : String(e));
    }
  });
}

async function pumpOnce(deps: HeavyDeps): Promise<void> {
  for (;;) {
    const jobs = await getJobs();
    if (!jobs.some((j) => j.status === 'queued')) {
      cancelRetry?.();
      cancelRetry = null;
      if (view.stalledSince !== undefined) { delete view.stalledSince; await publish(deps); }
      return;
    }
    if (jobs.some((j) => j.status === 'running')) return;
    const cfg = deps.config();
    if (!cfg) { view.online = null; await publish(deps); schedulePump(deps); return; }
    const online = await probeNow(cfg, deps);
    const stall = stalledSince(jobs, online, cfg.stallMin * 60_000, deps.now(), view.stalledSince);
    if (stall === undefined) delete view.stalledSince; else view.stalledSince = stall;
    await publish(deps);
    if (!online) { schedulePump(deps); return; }
    cancelRetry?.();
    cancelRetry = null;
    const job = await claimNext(deps.now());
    if (!job) continue;
    await publish(deps);
    await runJob(job, cfg, deps);
  }
}

export async function pump(deps: HeavyDeps): Promise<void> {
  if (pumping) { again = true; return; }
  pumping = true;
  try {
    do {
      again = false;
      await pumpOnce(deps).catch(() => {});
    } while (again);
  } finally { pumping = false; }
}

export const NOT_CONFIGURED = 'o executor não está configurado: crie ~/.cockpit/executor.json na máquina do Deck';

export type StartHeavyResult = { ok: true; job: HeavyJob; done: Promise<void> } | { ok: false; error: string };

export function resolveRequester(raw: unknown, team: Pick<TeamBot, 'id'>[]): string {
  return typeof raw === 'string' && team.some((b) => b.id === raw) ? raw : HUMAN;
}

export async function startHeavyJob(raw: unknown, deps: HeavyDeps): Promise<StartHeavyResult> {
  if (!deps.config()) return { ok: false, error: NOT_CONFIGURED };
  const v = validateJobInput(raw);
  if (!v.ok) return v;
  const requestedBy = resolveRequester((raw as { requestedBy?: unknown } | null)?.requestedBy, await deps.getTeam());
  if ((await getJobs()).filter(isActive).length >= MAX_ACTIVE) return { ok: false, error: 'fila do executor cheia, espere terminar algum job' };
  const job = newJob(deps.newId(), v.input, requestedBy, deps.now());
  try {
    await saveJob(job);
  } catch (e) {
    return { ok: false, error: `não consegui salvar o job: ${e instanceof Error ? e.message : String(e)}` };
  }
  await publish(deps);
  return { ok: true, job, done: pump(deps) };
}

export async function cancelHeavyJob(id: unknown, deps: HeavyDeps): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof id !== 'string' || !id) return { ok: false, error: 'job inválido' };
  if (current?.id === id) {
    current.reason = 'cancel';
    current.handle?.kill();
    return { ok: true };
  }
  const hit = await cancelQueued(id, deps.now());
  if (hit) { await publish(deps); return { ok: true }; }
  const job = (await getJobs()).find((j) => j.id === id);
  if (!job) return { ok: false, error: 'job não encontrado' };
  if (job.status === 'running') return { ok: false, error: 'o job roda em outro processo do Deck' };
  return { ok: false, error: 'o job já terminou' };
}

// On Deck start: a job left running lost its runner with the old process; queued ones resume.
export async function recoverHeavyJobs(deps: HeavyDeps): Promise<void> {
  if (await failInterruptedJobs(deps.now())) await publish(deps);
  await pump(deps);
}

// A cheap probe when someone looks at the page and nothing else has checked for a minute.
export async function refreshExecutorState(deps: HeavyDeps): Promise<void> {
  const cfg = deps.config();
  if (!cfg || pumping || current) return;
  if (view.checkedAt === undefined || deps.now() - view.checkedAt >= RETRY_MS) {
    await probeNow(cfg, deps);
    if (view.online) delete view.stalledSince;
  }
}
