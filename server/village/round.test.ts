import { describe, it, expect } from 'vitest';
import type { PlannerTask } from '../../shared/planner';
import { CLAIM_STALE_MS, isClaimable, matchesUnsafeNet, planRound, type RoundInput } from './round';

const NOW = Date.UTC(2026, 10, 17, 15);
const task = (o: Partial<PlannerTask>): PlannerTask => ({
  id: 't1', title: 'Write the docs', description: '', links: [], difficulty: 1, column: 'today', order: 1, createdAt: 1, updatedAt: 1,
  ready: true, ownerBotId: 'bob', ...o,
});
const team = [
  { id: 'iris', primary: true, department: 'direction' as const },
  { id: 'bob', department: 'engineering' as const },
  { id: 'amy', department: 'engineering' as const },
];
const input = (o: Partial<RoundInput>): RoundInput => ({
  tasks: [], team, state: { turns: {} }, now: NOW, config: { dailyCap: 6 }, running: new Set(), paused: false, ...o,
});

describe('planRound', () => {
  it('claims a ready task for its owner bot', () => {
    expect(planRound(input({ tasks: [task({})] })).claims).toEqual([{ taskId: 't1', botId: 'bob' }]);
  });

  it('does nothing when no task is ready, even with an owner', () => {
    const plan = planRound(input({ tasks: [task({ ready: undefined }), task({ id: 't2', ready: undefined, ownerSector: 'engineering', ownerBotId: undefined })] }));
    expect(plan).toEqual({ claims: [], releases: [] });
  });

  it('does nothing when paused', () => {
    const stale = task({ claim: { botId: 'bob', at: NOW - 2 * CLAIM_STALE_MS } });
    expect(planRound(input({ tasks: [task({ id: 't9', ownerBotId: 'amy' }), stale], paused: true }))).toEqual({ claims: [], releases: [] });
  });

  it('skips unsafe, claimed and done tasks', () => {
    const tasks = [
      task({ id: 'a', unsafe: true }),
      task({ id: 'b', claim: { botId: 'amy', at: NOW } , ownerBotId: 'amy' }),
      task({ id: 'c', column: 'done' }),
    ];
    expect(planRound(input({ tasks })).claims).toEqual([]);
  });

  it('never auto-claims what matches the unsafe keyword net', () => {
    for (const text of ['Run the migration', 'fix prod bug', 'Atualizar banco', 'rotate token', 'cobrar invoice', 'ação irreversível', 'run rm -rf build', 'DROP table', 'ajuste RLS', 'tratar produção']) {
      expect(matchesUnsafeNet({ title: text, description: '' })).toBe(true);
      expect(planRound(input({ tasks: [task({ title: text })] })).claims).toEqual([]);
    }
    expect(planRound(input({ tasks: [task({ description: 'touches the Supabase client' })] })).claims).toEqual([]);
    expect(matchesUnsafeNet({ title: 'Write the docs', description: 'Polish the landing page' })).toBe(false);
  });

  it('keeps one task per bot at a time (WIP 1)', () => {
    const tasks = [task({ id: 'a' }), task({ id: 'b', order: 2 })];
    expect(planRound(input({ tasks })).claims).toEqual([{ taskId: 'a', botId: 'bob' }]);
    const doing = [task({ id: 'x', ready: undefined, claim: { botId: 'bob', at: NOW - 60_000 } }), task({ id: 'b' })];
    expect(planRound(input({ tasks: doing })).claims).toEqual([]);
  });

  it('skips a bot that is running now', () => {
    expect(planRound(input({ tasks: [task({})], running: new Set(['bob']) })).claims).toEqual([]);
  });

  it('respects the daily cap by BRT date', () => {
    const state = { turns: { '2026-11-17': { bob: 6 } } };
    expect(planRound(input({ tasks: [task({})], state })).claims).toEqual([]);
    expect(planRound(input({ tasks: [task({})], state, config: { dailyCap: 7 } })).claims).toHaveLength(1);
    const yesterday = { turns: { '2026-11-16': { bob: 6 } } };
    expect(planRound(input({ tasks: [task({})], state: yesterday })).claims).toHaveLength(1);
    const lateUtc = Date.UTC(2026, 10, 18, 1);
    expect(planRound(input({ tasks: [task({})], state, now: lateUtc })).claims).toEqual([]);
  });

  it('falls back to the sector, skipping the primary bot', () => {
    const t = task({ ownerBotId: undefined, ownerSector: 'engineering' });
    expect(planRound(input({ tasks: [t], running: new Set(['bob']) })).claims).toEqual([{ taskId: 't1', botId: 'amy' }]);
    const dir = task({ ownerBotId: undefined, ownerSector: 'direction' });
    expect(planRound(input({ tasks: [dir] })).claims).toEqual([]);
  });

  it('claims for the primary only when it is the explicit owner', () => {
    expect(planRound(input({ tasks: [task({ ownerBotId: 'iris' })] })).claims).toEqual([{ taskId: 't1', botId: 'iris' }]);
  });

  it('ignores a task with neither owner nor sector', () => {
    expect(planRound(input({ tasks: [task({ ownerBotId: undefined })] })).claims).toEqual([]);
  });

  it('claims at most one task per bot per round and spreads across sector bots', () => {
    const tasks = [
      task({ id: 'a', ownerBotId: undefined, ownerSector: 'engineering' }),
      task({ id: 'b', ownerBotId: undefined, ownerSector: 'engineering', order: 2 }),
      task({ id: 'c', ownerBotId: undefined, ownerSector: 'engineering', order: 3 }),
    ];
    expect(planRound(input({ tasks })).claims).toEqual([{ taskId: 'a', botId: 'bob' }, { taskId: 'b', botId: 'amy' }]);
  });

  it('releases a claim older than 30 min with no sign of life', () => {
    const t = task({ ready: undefined, claim: { botId: 'bob', at: NOW - CLAIM_STALE_MS - 1 } });
    expect(planRound(input({ tasks: [t] })).releases).toEqual([{ taskId: 't1', botId: 'bob', reason: expect.any(String) }]);
  });

  it('keeps a claim that is young, running, or answered by a sent message', () => {
    const at = NOW - CLAIM_STALE_MS - 1;
    const old = task({ ready: undefined, claim: { botId: 'bob', at } });
    expect(planRound(input({ tasks: [task({ ready: undefined, claim: { botId: 'bob', at: NOW - 60_000 } })] })).releases).toEqual([]);
    expect(planRound(input({ tasks: [old], running: new Set(['bob']) })).releases).toEqual([]);
    expect(planRound(input({ tasks: [old], log: [{ from: 'bob', ts: at + 1000, status: 'delivered' }] })).releases).toEqual([]);
    expect(planRound(input({ tasks: [old], log: [{ from: 'bob', ts: at - 1000, status: 'delivered' }] })).releases).toHaveLength(1);
    expect(planRound(input({ tasks: [old], log: [{ from: 'bob', ts: at + 1000, status: 'blocked' }] })).releases).toHaveLength(1);
  });

  it('a released bot is not re-claimed in the same round', () => {
    const stale = task({ id: 's', ready: undefined, claim: { botId: 'bob', at: NOW - CLAIM_STALE_MS - 1 } });
    const next = task({ id: 'n', order: 2 });
    const plan = planRound(input({ tasks: [stale, next] }));
    expect(plan.releases).toHaveLength(1);
    expect(plan.claims).toEqual([]);
  });

  it('never claims a task an agent created, even when it is marked ready', () => {
    expect(isClaimable(task({ ready: true, source: 'agent' }))).toBe(false);
  });
});
