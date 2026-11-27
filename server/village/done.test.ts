import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PlannerTask } from '../../shared/planner';
import { readTasks, updateTasks } from '../planner/store';
import { processClaimed } from '../team-outbox';
import { applyTaskDone } from './done';

const task = (o: Partial<PlannerTask> = {}): PlannerTask => ({ id: 't1', title: 'Write docs', description: 'polish', links: [], difficulty: 1, column: 'doing' as never, order: 1, createdAt: 1, updatedAt: 1, ...o });
const done = (from: string, taskId = 't1', summary = 'done and filed') => ({ id: 'mabcdef12', from, to: from, text: '', hop: 1, ts: 1, taskDone: { taskId, summary } });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'village-done-'));
  Object.assign(process.env, { COCKPIT_PLANNER: join(dir, 'planner.json'), COCKPIT_VILLAGE_LOG: join(dir, 'vlog.jsonl'), COCKPIT_TEAM_LOG: join(dir, 'log.jsonl'), COCKPIT_BOTS_DIR: join(dir, 'bots') });
});
afterEach(async () => {
  for (const k of ['COCKPIT_PLANNER', 'COCKPIT_VILLAGE_LOG', 'COCKPIT_TEAM_LOG', 'COCKPIT_BOTS_DIR']) delete process.env[k];
  await rm(dir, { recursive: true, force: true });
});

const seed = (t: PlannerTask) => updateTasks(() => [t]);
const claimed = () => task({ column: 'today', claim: { botId: 'bob', at: 1 }, ready: true, readyBy: 'human', readyAt: 1 });

describe('team_task_done', () => {
  it('closes only the task in claim for the calling bot and appends the deliverable path', async () => {
    await seed(claimed());
    const r = await applyTaskDone(done('bob'), [], 5000);
    expect(r.ok).toBe(true);
    const [t] = await readTasks();
    expect(t.column).toBe('done');
    expect(t.claim).toBeUndefined();
    expect(t.ready).toBeUndefined();
    expect(t.description).toContain('done and filed');
    expect(t.description).toContain('workspace');
    expect(JSON.parse((await readFile(join(dir, 'vlog.jsonl'), 'utf8')).trim())).toMatchObject({ event: 'done', botId: 'bob', taskId: 't1' });
  });

  it('another bot is refused and the task stays in claim', async () => {
    await seed(claimed());
    const r = await applyTaskDone(done('eve'), [], 5000);
    expect(r).toMatchObject({ ok: false, reason: expect.stringContaining('outro bot') });
    const [t] = await readTasks();
    expect([t.column, t.claim?.botId]).toEqual(['today', 'bob']);
  });

  it('a task without claim is refused', async () => {
    await seed(task({ column: 'today', ownerBotId: 'bob' }));
    expect(await applyTaskDone(done('bob'), [], 5000)).toMatchObject({ ok: false });
    expect((await readTasks())[0].column).toBe('today');
  });

  it('an unknown task or an empty summary is refused', async () => {
    await seed(claimed());
    expect(await applyTaskDone(done('bob', 'nope'), [], 1)).toMatchObject({ ok: false });
    expect(await applyTaskDone(done('bob', 't1', '  '), [], 1)).toMatchObject({ ok: false });
  });

  it('through the outbox it is logged as delivered or blocked and never sent to a bot', async () => {
    await seed(claimed());
    const { writeFile } = await import('node:fs/promises');
    const p = join(dir, 'm.json');
    await writeFile(p, JSON.stringify(done('bob')));
    const team = [{ id: 'bob', name: 'bob' }] as never;
    const m = await processClaimed(p, { getTeam: async () => team, deliver: async () => { throw new Error('must not deliver'); }, applyTaskDone: (x, t) => applyTaskDone(x, t) });
    expect(m).toMatchObject({ status: 'delivered' });
    await writeFile(p, JSON.stringify({ ...done('bob'), id: 'mabcdef13' }));
    const again = await processClaimed(p, { getTeam: async () => team, deliver: async () => { throw new Error('no'); }, applyTaskDone: (x, t) => applyTaskDone(x, t) });
    expect(again).toMatchObject({ status: 'blocked' });
  });
});

describe('team_task_done summary', () => {
  it('redacts secrets before they reach the board', async () => {
    await seed(claimed());
    await applyTaskDone(done('bob', 't1', 'deployed with token=abcd1234efgh5678 and ghp_abcdefghijklmnopqrstu'), [], 5000);
    const [t] = await readTasks();
    expect(t.description).not.toContain('abcd1234efgh5678');
    expect(t.description).not.toContain('ghp_abcdefghijklmnopqrstu');
  });
});
