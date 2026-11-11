import { describe, it, expect } from 'vitest';
import type { PlannerTask } from '../../shared/planner';
import {
  adjacentColumn, applyMovesLocal, columnTasks, doneTodayCount, hiddenDoneCount, levelOf, levelProgress,
  orderBetween, planMove, streakDays, taskXp, topOrder, totalXp,
} from './planner-logic';

const DAY = 86_400_000;
const noon = new Date(2026, 5, 15, 12).getTime();
const mk = (o: Partial<PlannerTask> & { id: string }): PlannerTask => ({
  title: o.id, description: '', links: [], difficulty: 1, column: 'today', order: 0, createdAt: 0, updatedAt: 0, ...o,
});

describe('xp and level', () => {
  it('gives 10/25/50 by difficulty and counts only done tasks', () => {
    expect([1, 2, 3].map((d) => taskXp({ difficulty: d as 1 | 2 | 3 }))).toEqual([10, 25, 50]);
    const tasks = [mk({ id: 'a', column: 'done', difficulty: 3, doneAt: noon }), mk({ id: 'b', difficulty: 3 }), mk({ id: 'c', column: 'done', difficulty: 2, doneAt: noon })];
    expect(totalXp(tasks)).toBe(75);
  });

  it('levels every 100 xp', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(99)).toBe(1);
    expect(levelOf(100)).toBe(2);
    expect(levelProgress(250)).toEqual({ level: 3, into: 50, need: 100 });
  });
});

describe('streak', () => {
  const done = (id: string, daysAgo: number) => mk({ id, column: 'done', doneAt: noon - daysAgo * DAY });

  it('counts consecutive local days ending today', () => {
    expect(streakDays([done('a', 0), done('b', 1), done('c', 2), done('d', 4)], noon)).toBe(3);
  });

  it('survives a day without completions yet', () => {
    expect(streakDays([done('a', 1), done('b', 2)], noon)).toBe(2);
  });

  it('breaks after a gap and is zero when empty', () => {
    expect(streakDays([done('a', 2)], noon)).toBe(0);
    expect(streakDays([], noon)).toBe(0);
  });

  it('counts done today', () => {
    expect(doneTodayCount([done('a', 0), done('b', 0), done('c', 1)], noon)).toBe(2);
  });
});

describe('columnTasks', () => {
  it('sorts by order and limits done to 7 days unless showAll', () => {
    const tasks = [mk({ id: 'b', order: 2 }), mk({ id: 'a', order: 1 })];
    expect(columnTasks(tasks, 'today').map((t) => t.id)).toEqual(['a', 'b']);
    const done = [
      mk({ id: 'new', column: 'done', doneAt: noon - DAY }),
      mk({ id: 'old', column: 'done', doneAt: noon - 10 * DAY }),
      mk({ id: 'newest', column: 'done', doneAt: noon }),
    ];
    expect(columnTasks(done, 'done', { now: noon }).map((t) => t.id)).toEqual(['newest', 'new']);
    expect(columnTasks(done, 'done', { now: noon, showAllDone: true })).toHaveLength(3);
    expect(hiddenDoneCount(done, noon)).toBe(1);
  });
});

describe('reorder math', () => {
  const tasks = [mk({ id: 'a', order: 1 }), mk({ id: 'b', order: 2 }), mk({ id: 'c', order: 3 }), mk({ id: 'w', column: 'week', order: 10 })];

  it('computes between, before and after', () => {
    expect(orderBetween(1, 3)).toBe(2);
    expect(orderBetween(undefined, 5)).toBe(4);
    expect(orderBetween(5, undefined)).toBe(6);
    expect(orderBetween(undefined, undefined)).toBe(0);
    expect(topOrder(tasks, 'today')).toBe(0);
    expect(topOrder(tasks, 'backlog')).toBe(0);
  });

  it('plans a within-column move ignoring the moved task', () => {
    expect(planMove(tasks, 'c', 'today', 0)).toEqual({ id: 'c', column: 'today', order: 0 });
    expect(planMove(tasks, 'a', 'today', 1)).toEqual({ id: 'a', column: 'today', order: 2.5 });
    expect(planMove(tasks, 'a', 'today', 99)).toEqual({ id: 'a', column: 'today', order: 4 });
  });

  it('plans a cross-column move and rejects unknown ids', () => {
    expect(planMove(tasks, 'a', 'week', 0)).toEqual({ id: 'a', column: 'week', order: 9 });
    expect(planMove(tasks, 'zz', 'week', 0)).toBeNull();
  });

  it('applies moves locally with doneAt handling', () => {
    const out = applyMovesLocal(tasks, [{ id: 'a', column: 'done', order: 0 }], noon);
    expect(out[0]).toMatchObject({ column: 'done', doneAt: noon });
    const back = applyMovesLocal(out, [{ id: 'a', column: 'today', order: 0 }], noon + 1);
    expect(back[0].doneAt).toBeUndefined();
  });

  it('finds adjacent columns', () => {
    expect(adjacentColumn('today', -1)).toBeNull();
    expect(adjacentColumn('today', 1)).toBe('week');
    expect(adjacentColumn('done', 1)).toBeNull();
  });
});
