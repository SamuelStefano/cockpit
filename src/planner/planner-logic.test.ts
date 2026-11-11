import { describe, it, expect } from 'vitest';
import type { PlannerTask } from '../../shared/planner';
import {
  adjacentColumn, applyMovesLocal, columnTasks, hiddenDoneCount, isLockedRef, linkChipLabel, matchesFilter, orderBetween,
  planMove, tagsOf, topOrder,
} from './planner-logic';

const DAY = 86_400_000;
const noon = new Date(2026, 5, 15, 12).getTime();
const mk = (o: Partial<PlannerTask> & { id: string }): PlannerTask => ({
  title: o.id, description: '', links: [], difficulty: 1, column: 'today', order: 0, createdAt: 0, updatedAt: 0, ...o,
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

describe('filters', () => {
  const tasks = [
    mk({ id: 'a', title: 'Fix login', tag: 'DFL', ref: 'DFL-01498' }),
    mk({ id: 'b', title: 'Write post', description: 'about caching', tag: 'Tainan' }),
    mk({ id: 'c', title: 'Other' }),
  ];

  it('lists distinct sorted tags', () => {
    expect(tagsOf(tasks)).toEqual(['DFL', 'Tainan']);
  });

  it('matches title, description, ref and tag, case-insensitive', () => {
    const ids = (q: string, tags: string[] = []) => tasks.filter((t) => matchesFilter(t, q, tags)).map((t) => t.id);
    expect(ids('')).toEqual(['a', 'b', 'c']);
    expect(ids('dfl-014')).toEqual(['a']);
    expect(ids('CACHING')).toEqual(['b']);
    expect(ids('tainan')).toEqual(['b']);
    expect(ids('', ['DFL'])).toEqual(['a']);
    expect(ids('post', ['DFL'])).toEqual([]);
  });

  it('locks only DFL refs', () => {
    expect(isLockedRef('DFL-1')).toBe(true);
    expect(isLockedRef('placar:x')).toBe(false);
    expect(isLockedRef(undefined)).toBe(false);
  });
});

describe('linkChipLabel', () => {
  it('prefers the label, else the hostname without www', () => {
    expect(linkChipLabel({ url: 'https://www.github.com/x', label: 'PR' })).toBe('PR');
    expect(linkChipLabel({ url: 'https://www.github.com/x' })).toBe('github.com');
  });
});
