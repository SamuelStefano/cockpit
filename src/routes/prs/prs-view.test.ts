import { describe, expect, it } from 'vitest';
import type { PrSummary } from '../../../shared/prs';
import { dayLabel, filterPrs, groupByOrg, groupMergedByDay, mergedCountLabel, prBadges, relativeTime } from './prs-view';

const pr = (over: Partial<PrSummary> = {}): PrSummary => ({
  url: 'https://github.com/a/b/pull/1', number: 1, title: 't', repo: 'a/b', author: 'me', state: 'open', isDraft: false,
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', headRef: 'h', baseRef: 'main',
  additions: 1, deletions: 1, changedFiles: 1, checks: 'none', review: 'none', mergeable: 'ok', risk: 'safe', riskReasons: [], ...over,
});

describe('groupByOrg', () => {
  it('groups repos under orgs with counts', () => {
    const g = groupByOrg([pr({ repo: 'x/b' }), pr({ repo: 'x/b' }), pr({ repo: 'x/a' }), pr({ repo: 'y/c' })]);
    expect(g.map((o) => [o.org, o.total])).toEqual([['x', 3], ['y', 1]]);
    expect(g[0].repos).toEqual([{ repo: 'x/a', name: 'a', count: 1 }, { repo: 'x/b', name: 'b', count: 2 }]);
  });
});

describe('filterPrs', () => {
  const list = [pr({ repo: 'x/a' }), pr({ repo: 'x/b' }), pr({ repo: 'y/c' })];
  it('filters by org, repo or nothing', () => {
    expect(filterPrs(list, { org: null, repo: null })).toHaveLength(3);
    expect(filterPrs(list, { org: 'x', repo: null })).toHaveLength(2);
    expect(filterPrs(list, { org: 'x', repo: 'x/b' })).toHaveLength(1);
  });
});

describe('merged by day', () => {
  const now = new Date(2026, 10, 8, 15, 0);
  it('labels today, yesterday and older days', () => {
    expect(dayLabel(new Date(2026, 10, 8, 1), now)).toBe('Hoje');
    expect(dayLabel(new Date(2026, 10, 7, 23), now)).toBe('Ontem');
    expect(dayLabel(new Date(2026, 9, 3), now)).toBe('03/10');
  });
  it('sorts desc and groups', () => {
    const a = pr({ number: 1, mergedAt: new Date(2026, 10, 8, 9).toISOString() });
    const b = pr({ number: 2, mergedAt: new Date(2026, 10, 8, 12).toISOString() });
    const c = pr({ number: 3, mergedAt: new Date(2026, 10, 7, 12).toISOString() });
    const g = groupMergedByDay([a, c, b], now);
    expect(g.map((x) => x.label)).toEqual(['Hoje', 'Ontem']);
    expect(g[0].prs.map((p) => p.number)).toEqual([2, 1]);
  });
});

describe('prBadges', () => {
  it('maps states to labelled tones', () => {
    const b = prBadges(pr({ checks: 'failure', review: 'approved', mergeable: 'conflict', risk: 'unsafe', isDraft: true, task: 'DFL-9' }));
    expect(b.map((x) => x.label)).toEqual(['Rascunho', 'CI falhou', 'Aprovada', 'Conflito', 'Inseguro', 'DFL-9']);
    expect(b.find((x) => x.label === 'CI falhou')?.tone).toBe('red');
  });
  it('covers ok paths', () => {
    expect(prBadges(pr({ checks: 'success' })).map((x) => x.label)).toEqual(['CI ok', 'Seguro']);
    expect(prBadges(pr({ checks: 'pending', risk: 'maybe', review: 'changes' })).map((x) => x.label)).toEqual(['CI rodando', 'Mudanças pedidas', 'Talvez']);
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-11-08T12:00:00Z');
  it('formats minutes, hours and days', () => {
    expect(relativeTime('2026-11-08T11:55:00Z', now)).toBe('há 5 min');
    expect(relativeTime('2026-11-08T10:00:00Z', now)).toBe('há 2 h');
    expect(relativeTime('2026-11-05T12:00:00Z', now)).toBe('há 3 d');
    expect(relativeTime('2026-11-08T12:00:00Z', now)).toBe('agora');
  });
});

describe('merged rows and counts', () => {
  const merged = { url: 'u', number: 1, title: 't', repo: 'a/b', author: 'me', state: 'merged', isDraft: false, createdAt: '', updatedAt: '', mergedAt: '2026-11-07T10:00:00Z', headRef: 'h', baseRef: 'main', additions: 1, deletions: 1, changedFiles: 1, checks: 'none', review: 'none', mergeable: 'unknown', risk: 'safe', riskReasons: [] } as const;

  it('a merged PR shows no live badges (no fake "Seguro"), only its task', () => {
    expect(prBadges({ ...merged, riskReasons: [] })).toEqual([]);
    expect(prBadges({ ...merged, riskReasons: [], task: 'DFL-9' })).toEqual([{ label: 'DFL-9', tone: 'neutral' }]);
  });

  it('a capped merged list reads as a floor', () => {
    expect(mergedCountLabel(300, 30, true)).toBe('300+ mergeadas em 30 dias');
    expect(mergedCountLabel(12, 30, false)).toBe('12 mergeadas em 30 dias');
  });
});
