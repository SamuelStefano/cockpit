import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WebSocket } from 'ws';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PlannerTask } from '../../shared/planner';

vi.mock('./runs', () => ({ startRun: vi.fn(), routeSend: vi.fn(), orchestratorPaneTarget: vi.fn(), fireCron: vi.fn(), drainParked: vi.fn() }));
const bc = vi.hoisted(() => ({ send: vi.fn(), broadcast: vi.fn() }));
vi.mock('./broadcast', () => bc);
vi.mock('../skills', () => ({ listSkills: vi.fn(async () => []), readSkill: vi.fn(), resolveSkillDeny: vi.fn(async () => []) }));
vi.mock('../canvas/term-stats', () => ({
  collectTermStats: vi.fn(), collectCtxOnly: vi.fn(), hasInteractiveClaude: vi.fn(async () => false), newCpuSamples: vi.fn(() => new Map()),
}));
vi.mock('../canvas/cv-liveness', () => ({
  readBusyElsewhereSessionIds: vi.fn(async () => []), readBusyHeadlessElsewhereSessionIds: vi.fn(async () => []), readTmuxPaneSessionIds: vi.fn(async () => []), refreshLivenessSnapshot: vi.fn(),
}));

import { handle } from './dispatch';
import { authorize } from './authz';

const ws = {} as WebSocket;
const T = (o: Partial<PlannerTask> = {}): PlannerTask => ({ id: 't1', title: 'Rename a helper', description: '', links: [], difficulty: 1, column: 'today', order: 1, createdAt: 1, updatedAt: 1, ...o });
let dir: string;
const board = async (): Promise<PlannerTask[]> => JSON.parse(await readFile(process.env.COCKPIT_PLANNER!, 'utf8')).tasks;
const errors = () => bc.send.mock.calls.map((c) => c[1] as { t: string; message?: string }).filter((m) => m.t === 'error').map((m) => m.message);

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'planner-ready-'));
  process.env.COCKPIT_PLANNER = join(dir, 'planner.json');
  process.env.COCKPIT_VILLAGE_LOG = join(dir, 'log.jsonl');
  await writeFile(process.env.COCKPIT_PLANNER, JSON.stringify({ tasks: [T()] }));
  bc.send.mockClear();
});
afterEach(async () => {
  delete process.env.COCKPIT_PLANNER;
  delete process.env.COCKPIT_VILLAGE_LOG;
  await rm(dir, { recursive: true, force: true });
});

describe('planner-task-ready', () => {
  it('is refused without a verified human identity, with an explicit error and a log line', async () => {
    await handle(ws, { t: 'planner-task-ready', id: 't1', ready: true }, 'admin', {});
    expect((await board())[0].ready).toBeUndefined();
    expect(errors()[0]).toMatch(/ready refused/);
    await new Promise((r) => setTimeout(r, 20));
    expect(await readFile(process.env.COCKPIT_VILLAGE_LOG!, 'utf8')).toContain('"event":"ready refused"');
  });

  it('writes readyBy from the connection identity, never from the frame', async () => {
    await handle(ws, { t: 'planner-task-ready', id: 't1', ready: true, readyBy: 'human:forged' } as never, 'admin', { human: 'box1:dev1' });
    const t = (await board())[0];
    expect(t).toMatchObject({ ready: true, readyBy: 'human:box1:dev1' });
    expect(typeof t.readyAt).toBe('number');
  });

  it('refuses an unsafe task even from a human', async () => {
    await writeFile(process.env.COCKPIT_PLANNER!, JSON.stringify({ tasks: [T({ title: 'Mexer na Produção' })] }));
    await handle(ws, { t: 'planner-task-ready', id: 't1', ready: true }, 'admin', { human: 'box1:dev1' });
    expect((await board())[0].ready).toBeUndefined();
    expect(errors()[0]).toMatch(/unsafe/);
  });

  it('planner-task-save cannot set ready, even from a human connection', async () => {
    await handle(ws, { t: 'planner-task-save', task: T({ ready: true, readyBy: 'human:forged', readyAt: 5 } as Partial<PlannerTask>) }, 'admin', { human: 'box1:dev1' });
    expect((await board())[0].ready).toBeUndefined();
    expect(errors()[0]).toMatch(/ready refused/);
  });

  it('a human can unmark ready, and an edit after ready clears it', async () => {
    await handle(ws, { t: 'planner-task-ready', id: 't1', ready: true }, 'admin', { human: 'box1:dev1' });
    await handle(ws, { t: 'planner-task-save', task: { ...(await board())[0], title: 'Another title' } }, 'admin', {});
    expect((await board())[0].ready).toBeUndefined();
    await handle(ws, { t: 'planner-task-ready', id: 't1', ready: true }, 'admin', { human: 'box1:dev1' });
    await handle(ws, { t: 'planner-task-ready', id: 't1', ready: false }, 'admin', {});
    expect((await board())[0].ready).toBeUndefined();
  });

  it('is admin-only at the authz checkpoint', () => {
    expect(authorize('admin', 'planner-task-ready')).toBe(true);
    expect(authorize('student', 'planner-task-ready')).toBe(false);
  });
});
