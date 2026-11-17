import { describe, expect, it } from 'vitest';
import type { TeamBot } from './protocol';
import type { PlannerTask } from './planner';
import type { TeamMessage } from './team-messages';
import { buildTeamState, followUpHoursOf, pendingFollowUps } from './team-state';

const HOUR = 3_600_000;
const bot = (id: string, extra: Partial<TeamBot> = {}): TeamBot => ({ id, name: id.toUpperCase(), label: `role-${id}`, ...extra }) as TeamBot;
const msg = (id: string, from: string, to: string, ts: number, text = 'hi', status: TeamMessage['status'] = 'delivered'): TeamMessage => ({ id, from, to, text, ts, status, hop: 1 });
const task = (id: string, extra: Partial<PlannerTask> = {}): PlannerTask => ({ id, title: id, description: '', links: [], difficulty: 1, column: 'today', order: 0, createdAt: 0, updatedAt: 0, ...extra });

describe('buildTeamState', () => {
  const base = { running: new Set<string>(), waiting: new Set<string>(), now: 10 * HOUR };

  it('maps role, sector, manager and status', () => {
    const s = buildTeamState({
      ...base, tasks: [], log: [],
      running: new Set(['b']), waiting: new Set(['c', 'b']),
      team: [bot('a', { department: 'growth' }), bot('b', { parentId: 'a' }), bot('c', { parentId: 'gone' })],
    });
    expect(s.bots[0]).toMatchObject({ id: 'a', role: 'role-a', sector: 'growth', status: 'idle' });
    expect(s.bots[1]).toMatchObject({ manager: 'a', status: 'waiting' });
    expect(s.bots[2].manager).toBeUndefined();
  });

  it('marks a bot that holds a claim as doing, ids only', () => {
    const s = buildTeamState({
      ...base, team: [bot('a'), bot('b')], log: [],
      tasks: [task('t1', { claim: { botId: 'a', at: 1 } }), task('t2', { column: 'done', claim: { botId: 'b', at: 1 } })],
    });
    expect(s.bots[0].doing).toBe(true);
    expect(s.bots[1].doing).toBeUndefined();
  });

  it('picks the nearest open owned task as the current one', () => {
    const s = buildTeamState({
      ...base, team: [bot('a')], log: [],
      tasks: [task('t-done', { ownerBotId: 'a', column: 'done' }), task('t-week', { ownerBotId: 'a', column: 'week' }), task('t-today', { ownerBotId: 'a', column: 'today' }), task('other')],
    });
    expect(s.bots[0].task).toBe('t-today');
  });

  it('clips the last send to a 120-char one-line preview and ignores blocked ones', () => {
    const s = buildTeamState({
      ...base, team: [bot('a'), bot('b')], tasks: [],
      log: [msg('m1', 'a', 'b', 1, 'x'.repeat(300)), msg('m2', 'a', 'b', 2, 'blocked', 'blocked')],
    });
    expect(s.bots[0].lastSend).toEqual({ to: 'b', at: 1, preview: 'x'.repeat(120) });
  });

  it('lists handoffs newest first with the switch point clipped', () => {
    const h = (at: number, switchPoint: string) => ({ at, fromBotId: 'a', toBotId: 'b', done: 'd', pending: 'p', reason: 'r', switchPoint });
    const s = buildTeamState({ ...base, team: [bot('a'), bot('b')], log: [], tasks: [task('t1', { handoffs: [h(1, 'old'), h(2, 'y'.repeat(200))] })] });
    expect(s.handoffs.map((x) => x.at)).toEqual([2, 1]);
    expect(s.handoffs[0]).toMatchObject({ from: 'a', to: 'b', taskId: 't1', point: 'y'.repeat(120) });
  });
});

describe('pendingFollowUps', () => {
  const team = [{ id: 'a' }, { id: 'b' }];
  const now = 10 * HOUR;

  it('flags a request older than N hours with no reply', () => {
    expect(pendingFollowUps([msg('m1', 'a', 'b', 1 * HOUR)], team, now, 4)).toEqual([{ from: 'a', to: 'b', at: HOUR, preview: 'hi' }]);
  });

  it('skips a recent request, a replied one and a blocked one', () => {
    expect(pendingFollowUps([msg('m1', 'a', 'b', 8 * HOUR)], team, now, 4)).toEqual([]);
    expect(pendingFollowUps([msg('m1', 'a', 'b', 1 * HOUR), msg('m2', 'b', 'a', 2 * HOUR)], team, now, 4).map((x) => x.from)).toEqual(['b']);
    expect(pendingFollowUps([msg('m1', 'a', 'b', 1 * HOUR, 'x', 'blocked')], team, now, 4)).toEqual([]);
  });

  it('honors a configurable window and defaults bad values to 4h', () => {
    expect(pendingFollowUps([msg('m1', 'a', 'b', 8 * HOUR)], team, now, 1)).toHaveLength(1);
    expect(followUpHoursOf(undefined)).toBe(4);
    expect(followUpHoursOf(-2)).toBe(4);
    expect(followUpHoursOf('2')).toBe(2);
  });

  it('matches replies by direction and uses only the latest one per pair', () => {
    const log = [msg('m1', 'a', 'b', 1 * HOUR), msg('m2', 'b', 'a', 0.5 * HOUR), msg('m3', 'b', 'a', 3 * HOUR), msg('m4', 'a', 'b', 2 * HOUR)];
    expect(pendingFollowUps(log, team, now, 4).map((x) => x.at)).toEqual([3 * HOUR]);
  });

  it('handles a large log', () => {
    const log = Array.from({ length: 20_000 }, (_, i) => msg(`m${i}`, 'a', 'b', i, 'x', i % 2 ? 'blocked' : 'delivered'));
    expect(pendingFollowUps(log, team, now, 4)).toHaveLength(30);
  });
});
