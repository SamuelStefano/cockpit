import { describe, it, expect } from 'vitest';
import { groupByRecency } from './group-by-recency';
import type { Session } from '../../data/mock';

const DAY = 86_400_000;
const session = (id: string, mtime: number): Session => ({
  id, mtime, title: id, relative: '', snippet: '', hasTerminal: false, active: false,
});

// Boundaries are relative to the start of today, so anchor offsets off "now".
const now = Date.now();
const startOfToday = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();

describe('groupByRecency', () => {
  it('buckets sessions by mtime and drops empty buckets', () => {
    const groups = groupByRecency(
      [
        session('today', startOfToday + 1000),
        session('yest', startOfToday - DAY + 1000),
        session('week', startOfToday - 3 * DAY),
        session('month', startOfToday - 15 * DAY),
        session('old', startOfToday - 90 * DAY),
      ],
      new Set(),
    );
    expect(groups.map((g) => g.label)).toEqual(['Hoje', 'Ontem', '7 dias', '30 dias', 'Anteriores']);
  });

  it('routes running sessions to the top bucket regardless of mtime', () => {
    const groups = groupByRecency(
      [session('r', startOfToday - 90 * DAY)],
      new Set(),
      new Set(['r']),
    );
    expect(groups).toEqual([{ label: 'Trabalhando agora', items: [session('r', startOfToday - 90 * DAY)] }]);
  });

  it('puts pinned (non-running) sessions in the Fixadas bucket', () => {
    const groups = groupByRecency(
      [session('p', startOfToday + 1000)],
      new Set(['p']),
    );
    expect(groups.map((g) => g.label)).toEqual(['Fixadas']);
  });

  it('prefers running over pinned when a session is both', () => {
    const groups = groupByRecency(
      [session('x', startOfToday + 1000)],
      new Set(['x']),
      new Set(['x']),
    );
    expect(groups.map((g) => g.label)).toEqual(['Trabalhando agora']);
  });

  it('returns an empty array when there are no sessions', () => {
    expect(groupByRecency([], new Set())).toEqual([]);
  });
});
