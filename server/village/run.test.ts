import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TeamBot } from '../../shared/protocol';
import type { PlannerTask } from '../../shared/planner';
import { readTasks, updateTasks } from '../planner/store';
import { readVillage, setVillageSettings } from './store';
import { runRound, type RoundDeps } from './round';

const bot = (id: string, o: Partial<TeamBot> = {}): TeamBot => ({ id, name: id, label: '', instructions: '', mascot: { shape: 'blob', color: '#fff' }, profile: 'full', createdAt: 0, updatedAt: 0, ...o });
const team = [bot('iris', { primary: true, sessionId: 's-iris' }), bot('bob', { department: 'engineering', sessionId: 's-bob' })];
const task = (o: Partial<PlannerTask> = {}): PlannerTask => ({ id: 't1', title: 'Write docs', description: 'polish', links: [], difficulty: 1, column: 'today', order: 1, createdAt: 1, updatedAt: 1, ...o });

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'village-run-'));
  process.env.COCKPIT_VILLAGE = join(dir, 'village.json');
  process.env.COCKPIT_PLANNER = join(dir, 'planner.json');
  process.env.COCKPIT_TEAM_OUTBOX = join(dir, 'outbox');
  process.env.COCKPIT_VILLAGE_LOG = join(dir, 'village-log.jsonl');
  await setVillageSettings({ enabled: true });
});
afterEach(async () => {
  for (const k of ['COCKPIT_VILLAGE', 'COCKPIT_PLANNER', 'COCKPIT_TEAM_OUTBOX', 'COCKPIT_VILLAGE_LOG']) delete process.env[k];
  await rm(dir, { recursive: true, force: true });
});

const deps = (status: 'delivered' | 'failed' | 'blocked', calls: string[] = []): RoundDeps => ({
  now: () => 10_000_000,
  isPaused: () => false,
  getTeam: async () => team,
  running: () => new Set(),
  deliver: async (path) => { calls.push(path); return { id: 'm1', from: 'iris', to: 'bob', text: '', ts: 1, status, hop: 1 }; },
  onBoard: () => {},
});

describe('runRound', () => {
  it('does zero work with nothing ready', async () => {
    await updateTasks(() => [task()]);
    const calls: string[] = [];
    const r = await runRound(deps('delivered', calls));
    expect(r).toEqual({ claimed: [], released: [], failed: [] });
    expect(calls).toEqual([]);
    expect((await readVillage()).events).toEqual([]);
  });

  it('claims, records the handoff and counts the turn only after delivery', async () => {
    await updateTasks(() => [task({ ready: true, ownerBotId: 'bob' })]);
    const calls: string[] = [];
    const r = await runRound(deps('delivered', calls));
    expect(r.claimed).toEqual([{ taskId: 't1', botId: 'bob' }]);
    const [t] = await readTasks();
    expect(t.claim).toEqual({ botId: 'bob', at: 10_000_000, sentAt: 10_000_000 });
    expect(t.handoffs?.at(-1)).toMatchObject({ toBotId: 'bob', reason: 'village round' });
    const v = await readVillage();
    expect(Object.values(v.turns)[0]).toEqual({ bob: 1 });
    expect(v.events).toMatchObject([{ type: 'claim', botId: 'bob', taskId: 't1' }]);
  });

  it('removes the claim and counts nothing when delivery fails or is blocked', async () => {
    for (const status of ['failed', 'blocked'] as const) {
      await updateTasks(() => [task({ ready: true, ownerSector: 'engineering' })]);
      const r = await runRound(deps(status));
      expect(r.failed).toHaveLength(1);
      const [t] = await readTasks();
      expect(t.claim).toBeUndefined();
      expect(t.ownerBotId).toBeUndefined();
      expect(t.handoffs).toBeUndefined();
      expect(t.ready).toBe(true);
      expect((await readVillage()).turns).toEqual({});
    }
  });

  it('never runs while paused', async () => {
    await updateTasks(() => [task({ ready: true, ownerBotId: 'bob' })]);
    const calls: string[] = [];
    const r = await runRound({ ...deps('delivered', calls), isPaused: () => true });
    expect(r.claimed).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('does nothing while disabled, which is the default', async () => {
    await setVillageSettings({ enabled: false });
    await updateTasks(() => [task({ ready: true, ownerBotId: 'bob' })]);
    const calls: string[] = [];
    expect(await runRound(deps('delivered', calls))).toEqual({ claimed: [], released: [], failed: [] });
    expect(calls).toEqual([]);
    expect((await readTasks())[0].claim).toBeUndefined();
  });

  it('re-checks the kill switch right before delivering and drops the claim', async () => {
    await updateTasks(() => [task({ ready: true, ownerBotId: 'bob' })]);
    const calls: string[] = [];
    let n = 0;
    const r = await runRound({ ...deps('delivered', calls), isPaused: () => ++n > 2 });
    expect(calls).toEqual([]);
    expect(r.claimed).toEqual([]);
    expect((await readTasks())[0].claim).toBeUndefined();
  });

  it('writes the log line for a claim without any prompt text', async () => {
    await updateTasks(() => [task({ ready: true, ownerBotId: 'bob', description: 'topsecret body' })]);
    await runRound(deps('delivered'));
    const log = await readFile(process.env.COCKPIT_VILLAGE_LOG!, 'utf8');
    expect(JSON.parse(log.trim())).toMatchObject({ event: 'claim', taskId: 't1', botId: 'bob' });
    expect(log).not.toContain('topsecret');
  });

  it('releases a stale claim and records the event', async () => {
    await updateTasks(() => [task({ claim: { botId: 'bob', at: 1 }, ownerBotId: 'bob' })]);
    const r = await runRound(deps('delivered'));
    expect(r.released).toHaveLength(1);
    expect((await readTasks())[0].claim).toBeUndefined();
    expect((await readVillage()).events[0]).toMatchObject({ type: 'release', botId: 'bob' });
  });
});
