import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WebSocket } from 'ws';
import type { ServerMsg } from '../../shared/protocol';
import { getJobs, resetHeavyRuntime, type HeavyDeps } from '../heavy-jobs';
import { cancelHeavyFrame, runHeavyFrame, sendHeavy } from './heavy-frames';

let dir: string;
let sent: ServerMsg[];
let spawned: string[][];
let configured: boolean;

const ws = { OPEN: 1, readyState: 1, send: (s: string) => { sent.push(JSON.parse(s)); } } as unknown as WebSocket;
const deps = (): HeavyDeps => ({
  config: () => (configured ? { label: 'PC', probe: ['p'], run: ['r', '{command}'], timeoutMin: 30, stallMin: 10 } : null),
  probe: async () => false,
  spawn: (argv) => { spawned.push(argv); return { kill: () => {} }; },
  getTeam: async () => [],
  publish: () => {},
  setTimer: () => () => {},
  now: () => 5,
  newId: () => 'j1',
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hf-'));
  process.env.COCKPIT_HEAVY_JOBS = join(dir, 'jobs.json');
  sent = [];
  spawned = [];
  configured = true;
  resetHeavyRuntime();
});
afterEach(() => { delete process.env.COCKPIT_HEAVY_JOBS; rmSync(dir, { recursive: true, force: true }); });

describe('heavy frames', () => {
  it('sends the executor state and the jobs, never the argv templates', async () => {
    await sendHeavy(ws, deps());
    const msg = sent[0] as Extract<ServerMsg, { t: 'heavy' }>;
    expect(msg.t).toBe('heavy');
    expect(msg.executor).toMatchObject({ configured: true, label: 'PC', online: false });
    expect(JSON.stringify(msg)).not.toContain('"run"');
    expect(JSON.stringify(msg)).not.toContain('"probe"');
  });
  it('answers an error frame when the executor is not configured', async () => {
    configured = false;
    await runHeavyFrame(ws, { t: 'heavy-run', repo: 'a/b', branch: 'x', command: 'ls' }, deps());
    expect(sent[0]).toMatchObject({ t: 'error' });
    expect(await getJobs()).toEqual([]);
  });
  it('answers an error frame for an invalid job and queues a valid one', async () => {
    await runHeavyFrame(ws, { t: 'heavy-run', repo: 'a/b', branch: '..', command: 'ls' }, deps());
    expect(sent[0]).toMatchObject({ t: 'error' });
    await runHeavyFrame(ws, { t: 'heavy-run', repo: 'a/b', branch: 'main', command: 'ls' }, deps());
    expect(sent).toHaveLength(1);
    expect((await getJobs())[0]).toMatchObject({ status: 'queued', requestedBy: 'human' });
    expect(spawned).toEqual([]);
  });
  it('reports an unknown job on cancel', async () => {
    await cancelHeavyFrame(ws, 'nope', deps());
    expect(sent[0]).toEqual({ t: 'error', message: 'job não encontrado' });
  });
});
