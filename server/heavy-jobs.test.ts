import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TeamBot } from '../shared/protocol';
import type { ExecutorState, HeavyJob } from '../shared/heavy-job';
import type { ExecutorConfig, RunHandlers } from './heavy-executor';
import {
  FLUSH_MS, NOT_CONFIGURED, RETRY_MS, cancelHeavyJob, getJobs, heavySnapshot, pump, recoverHeavyJobs, refreshExecutorState, resetHeavyRuntime,
  saveJob, startHeavyJob, type HeavyDeps,
} from './heavy-jobs';

const bot = (id: string, name: string): TeamBot => ({
  id, name, label: 'l', instructions: '', mascot: { shape: 'drop', color: '#fff' }, profile: 'full', createdAt: 1, updatedAt: 1,
});
const cfg: ExecutorConfig = { label: 'PC', probe: ['probe-bin', 'x'], run: ['run-bin', '{repo}', '{branch}', '{dir}', '{command}'], timeoutMin: 30, stallMin: 10 };
const input = { repo: 'org/app', branch: 'feat/x', command: 'npm test' };

interface Run { argv: string[]; h: RunHandlers; killed: boolean }
interface Timer { fn: () => void; ms: number; live: boolean }

let dir: string;
let clock: number;
let online: boolean;
let config: ExecutorConfig | null;
let runs: Run[];
let timers: Timer[];
let published: { executor: ExecutorState; jobs: HeavyJob[] }[];
let probes: number;
let ids: number;

function deps(): HeavyDeps {
  return {
    config: () => config,
    probe: async () => { probes++; return online; },
    spawn: (argv, h) => {
      const run: Run = { argv, h, killed: false };
      runs.push(run);
      return { kill: () => { run.killed = true; h.onExit(null); } };
    },
    getTeam: async () => [bot('a1', 'Ana')],
    publish: (executor, jobs) => { published.push({ executor, jobs: JSON.parse(JSON.stringify(jobs)) }); },
    setTimer: (fn, ms) => { const t: Timer = { fn, ms, live: true }; timers.push(t); return () => { t.live = false; }; },
    now: () => clock,
    newId: () => `j${++ids}`,
  };
}

const liveTimer = (ms: number) => timers.find((t) => t.live && t.ms === ms);
const fire = (ms: number) => { const t = liveTimer(ms); if (!t) throw new Error(`no timer ${ms}`); t.live = false; t.fn(); };
const last = () => published[published.length - 1];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hj-'));
  process.env.COCKPIT_HEAVY_JOBS = join(dir, 'heavy-jobs.json');
  clock = 1_000;
  online = true;
  config = cfg;
  runs = [];
  timers = [];
  published = [];
  probes = 0;
  ids = 0;
  resetHeavyRuntime();
});
afterEach(() => { delete process.env.COCKPIT_HEAVY_JOBS; rmSync(dir, { recursive: true, force: true }); });

async function start(over: Record<string, unknown> = {}) {
  const r = await startHeavyJob({ ...input, ...over }, deps());
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe('startHeavyJob', () => {
  it('refuses with a clear message when the executor is not configured', async () => {
    config = null;
    expect(await startHeavyJob(input, deps())).toEqual({ ok: false, error: NOT_CONFIGURED });
    expect(await getJobs()).toEqual([]);
  });
  it('validates at the edge', async () => {
    const r = await startHeavyJob({ ...input, branch: '--upload-pack=x' }, deps());
    expect(r.ok).toBe(false);
    expect(await getJobs()).toEqual([]);
  });
  it('stores a bot id as requester and anything else as human', async () => {
    const a = await start({ requestedBy: 'a1' });
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    runs[0].h.onExit(0);
    await a.done;
    online = false;
    const b = await start({ requestedBy: 'ghost' });
    await b.done;
    const jobs = await getJobs();
    expect(jobs.find((j) => j.id === 'j1')?.requestedBy).toBe('a1');
    expect(jobs.find((j) => j.id === 'j2')?.requestedBy).toBe('human');
  });
});

describe('running', () => {
  it('spawns the argv built from the config template and finishes done', async () => {
    const r = await start({ dir: 'web' });
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(runs[0].argv).toEqual(['run-bin', 'org/app', 'feat/x', 'web', 'npm test']);
    runs[0].h.onData('hello\n');
    runs[0].h.onExit(0);
    await r.done;
    expect((await getJobs())[0]).toMatchObject({ status: 'done', exitCode: 0, tail: 'hello\n', startedAt: 1_000, endedAt: 1_000 });
    expect(last().executor).toMatchObject({ configured: true, label: 'PC', online: true });
  });
  it('fails with the exit code', async () => {
    const r = await start();
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    runs[0].h.onExit(3);
    await r.done;
    expect((await getJobs())[0]).toMatchObject({ status: 'failed', exitCode: 3 });
  });
  it('fails with the spawn error when there is no exit code', async () => {
    const r = await start();
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    runs[0].h.onExit(null, 'spawn ENOENT');
    await r.done;
    expect((await getJobs())[0]).toMatchObject({ status: 'failed', error: 'spawn ENOENT' });
  });
  it('runs one job at a time, oldest first', async () => {
    const a = await start();
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    clock = 2_000;
    await start({ command: 'npm run build' });
    expect(runs).toHaveLength(1);
    runs[0].h.onExit(0);
    await vi.waitFor(() => expect(runs).toHaveLength(2));
    expect(runs[1].argv.at(-1)).toBe('npm run build');
    runs[1].h.onExit(0);
    await a.done;
    expect((await getJobs()).map((j) => j.status)).toEqual(['done', 'done']);
  });
  it('persists and broadcasts the tail at most once per flush window', async () => {
    const r = await start();
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    const before = published.length;
    for (let i = 0; i < 50; i++) runs[0].h.onData(`line ${i}\n`);
    expect(timers.filter((t) => t.live && t.ms === FLUSH_MS)).toHaveLength(1);
    fire(FLUSH_MS);
    await vi.waitFor(() => expect(published.length).toBe(before + 1));
    expect(last().jobs[0].tail).toContain('line 49');
    runs[0].h.onExit(0);
    await r.done;
  });
  it('kills and fails with "tempo esgotado" at the timeout', async () => {
    const r = await start();
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    fire(cfg.timeoutMin * 60_000);
    await r.done;
    expect(runs[0].killed).toBe(true);
    expect((await getJobs())[0]).toMatchObject({ status: 'failed', error: 'tempo esgotado' });
  });
});

describe('offline executor', () => {
  it('keeps the job queued, re-probes every minute and runs it once online', async () => {
    online = false;
    const r = await start();
    await r.done;
    expect((await getJobs())[0].status).toBe('queued');
    expect(last().executor).toMatchObject({ online: false, checkedAt: 1_000 });
    expect(last().executor.stalledSince).toBeUndefined();
    expect(runs).toHaveLength(0);
    online = true;
    fire(RETRY_MS);
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    runs[0].h.onExit(0);
    await vi.waitFor(async () => expect((await getJobs())[0].status).toBe('done'));
  });
  it('marks a stall after stallMin, holds it, and clears it when back online', async () => {
    online = false;
    await (await start()).done;
    clock = 1_000 + 9 * 60_000;
    fire(RETRY_MS);
    await vi.waitFor(() => expect(probes).toBe(2));
    await vi.waitFor(() => expect(liveTimer(RETRY_MS)).toBeDefined());
    expect(last().executor.stalledSince).toBeUndefined();
    clock = 1_000 + 10 * 60_000;
    fire(RETRY_MS);
    await vi.waitFor(() => expect(last().executor.stalledSince).toBe(clock));
    const since = clock;
    clock += 5 * 60_000;
    await vi.waitFor(() => expect(liveTimer(RETRY_MS)).toBeDefined());
    fire(RETRY_MS);
    await vi.waitFor(() => expect(probes).toBe(4));
    await vi.waitFor(() => expect(liveTimer(RETRY_MS)).toBeDefined());
    expect(last().executor.stalledSince).toBe(since);
    online = true;
    fire(RETRY_MS);
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(last().executor.stalledSince).toBeUndefined();
    runs[0].h.onExit(0);
  });
  it('goes quiet when the config disappears, without failing the job', async () => {
    online = false;
    await (await start()).done;
    config = null;
    fire(RETRY_MS);
    await vi.waitFor(() => expect(last().executor.configured).toBe(false));
    expect((await getJobs())[0].status).toBe('queued');
  });
});

describe('cancel', () => {
  it('cancels a queued job without spawning', async () => {
    online = false;
    await (await start()).done;
    expect(await cancelHeavyJob('j1', deps())).toEqual({ ok: true });
    expect((await getJobs())[0]).toMatchObject({ status: 'cancelled' });
    expect(runs).toHaveLength(0);
  });
  it('kills a running job and ends it cancelled', async () => {
    const r = await start();
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    expect(await cancelHeavyJob('j1', deps())).toEqual({ ok: true });
    await r.done;
    expect(runs[0].killed).toBe(true);
    expect((await getJobs())[0].status).toBe('cancelled');
  });
  it('answers plainly for unknown and finished jobs', async () => {
    expect(await cancelHeavyJob('nope', deps())).toEqual({ ok: false, error: 'job não encontrado' });
    expect(await cancelHeavyJob(7, deps())).toMatchObject({ ok: false });
    const r = await start();
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    runs[0].h.onExit(0);
    await r.done;
    expect(await cancelHeavyJob('j1', deps())).toEqual({ ok: false, error: 'o job já terminou' });
  });
});

describe('recoverHeavyJobs', () => {
  it('fails a job left running and resumes the queued ones', async () => {
    const base = { repo: 'r', branch: 'b', command: 'c', requestedBy: 'human', tail: '' };
    await saveJob({ ...base, id: 'old', status: 'running', createdAt: 1, startedAt: 2 });
    await saveJob({ ...base, id: 'wait', status: 'queued', createdAt: 3 });
    const done = recoverHeavyJobs(deps());
    await vi.waitFor(() => expect(runs).toHaveLength(1));
    const jobs = await getJobs();
    expect(jobs.find((j) => j.id === 'old')).toMatchObject({ status: 'failed', error: 'interrompido por reinício' });
    expect(runs[0].argv[1]).toBe('r');
    runs[0].h.onExit(0);
    await done;
  });
});

describe('refreshExecutorState', () => {
  it('probes at most once a minute when nothing is queued', async () => {
    await refreshExecutorState(deps());
    await refreshExecutorState(deps());
    expect(probes).toBe(1);
    clock += RETRY_MS;
    online = false;
    await refreshExecutorState(deps());
    expect(probes).toBe(2);
    expect((await heavySnapshot(deps())).executor).toMatchObject({ online: false });
  });
  it('does nothing when not configured', async () => {
    config = null;
    await refreshExecutorState(deps());
    expect(probes).toBe(0);
    expect((await heavySnapshot(deps())).executor).toEqual({ configured: false, label: '', online: null });
  });
});

describe('pump', () => {
  it('does nothing with an empty queue', async () => {
    await pump(deps());
    expect(probes).toBe(0);
  });
});
