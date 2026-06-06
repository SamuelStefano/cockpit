import { describe, it, expect } from 'vitest';
import { groupByRecency } from './Sessions';

const DAY = 86_400_000;
const startOfToday = (() => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
})();

const s = (id: string, mtime: number) => ({ id, mtime }) as any;

describe('groupByRecency', () => {
  it('omits empty buckets', () => {
    const out = groupByRecency([s('a', startOfToday + 1000)], new Set());
    expect(out.map((b) => b.label)).toEqual(['Hoje']);
  });

  it('routes by recency window', () => {
    const out = groupByRecency([
      s('today', startOfToday + 1000),
      s('yest', startOfToday - DAY + 1000),
      s('week', startOfToday - 3 * DAY),
      s('month', startOfToday - 20 * DAY),
      s('old', startOfToday - 100 * DAY),
    ], new Set());
    expect(out.map((b) => [b.label, b.items.map((i: any) => i.id)])).toEqual([
      ['Hoje', ['today']],
      ['Ontem', ['yest']],
      ['7 dias', ['week']],
      ['30 dias', ['month']],
      ['Anteriores', ['old']],
    ]);
  });

  it('running takes precedence over pinned and date', () => {
    const out = groupByRecency([s('a', startOfToday + 1000)], new Set(['a']), new Set(['a']));
    expect(out).toEqual([{ label: 'Trabalhando agora', items: [s('a', startOfToday + 1000)] }]);
  });

  it('pinned takes precedence over date when not running', () => {
    const out = groupByRecency([s('a', startOfToday + 1000)], new Set(['a']));
    expect(out.map((b) => b.label)).toEqual(['Fixadas']);
  });

  it('returns no buckets for an empty list', () => {
    expect(groupByRecency([], new Set())).toEqual([]);
  });
});
