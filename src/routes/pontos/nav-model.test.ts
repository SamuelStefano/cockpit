import { describe, it, expect } from 'vitest';
import type { DflProjectNode, DflTaskStatus } from '../../../shared/protocol';
import { sanitizeDrafts } from '../../../shared/dfl-drafts';
import { buildNav, marksByEpic, type NavOptions } from './nav-model';

const task = (id: string, status: DflTaskStatus, points: number) => ({ id, name: id, points, status, rawStatus: 'done', amountCents: points * 7500 });
const project = (name: string, epics: [string, string, ReturnType<typeof task>[]][]): DflProjectNode => ({
  id: name, name, points: 0, amountCents: 0,
  epics: epics.map(([id, epName, tasks]) => ({
    id, name: epName, status: 'active', points: tasks.reduce((s, t) => s + t.points, 0), amountCents: tasks.reduce((s, t) => s + t.amountCents, 0),
    deliveries: [{ id: `d-${id}`, name: epName, status: 'x', pricePerPoint: 75, points: 0, amountCents: 0, tasks }],
  })),
});

const PROJECTS = [
  project('ITERA', [['e1', 'Itera - Melhorias', [task('a', 'paid', 10), task('b', 'open', 60)]], ['e2', 'Laboratório', [task('c', 'paid', 5)]]]),
  project('Apps', [['e3', 'Lesson Studio', [task('d', 'todo', 3)]]]),
];
const DRAFTS = sanitizeDrafts([{ id: 'ep-1', title: 'Câmera e render', status: 'draft', createdAt: 0, tasks: [{ id: 't', title: 't', points: 24, refs: [] }] }]);
const opts = (o: Partial<NavOptions> = {}): NavOptions => ({ pointValue: 75, excluded: new Set(), filter: 'all', query: '', ...o });

describe('buildNav', () => {
  it('groups drafts, DFL epics with open/todo work and fully invoiced ones', () => {
    const n = buildNav(DRAFTS, PROJECTS, opts());
    expect(n.drafts.map((r) => [r.key, r.points, r.valueCents, r.capPct, r.tone])).toEqual([['draft:ep-1', 24, 180_000, 36, 'draft']]);
    expect(n.open.map((r) => [r.title, r.tone, r.context])).toEqual([['Itera - Melhorias', 'open', 'ITERA'], ['Lesson Studio', 'todo', 'Apps']]);
    expect(n.billed.map((r) => r.title)).toEqual(['Laboratório']);
  });

  it('flags an epic whose paid + open value passes the R$ 5k cap', () => {
    const [itera] = buildNav([], PROJECTS, opts()).open;
    expect(itera).toMatchObject({ over: true, capPct: 105 });
  });

  it('searches titles and projects ignoring accents and case', () => {
    expect(buildNav(DRAFTS, PROJECTS, opts({ query: 'camera' })).drafts).toHaveLength(1);
    const n = buildNav(DRAFTS, PROJECTS, opts({ query: 'itera' }));
    expect([n.drafts.length, n.open.length, n.billed.length]).toEqual([0, 1, 1]);
  });

  it('a status filter narrows DFL epics and hides drafts unless it is "a fazer"', () => {
    const paid = buildNav(DRAFTS, PROJECTS, opts({ filter: 'paid' }));
    expect([paid.drafts.length, paid.open.length, paid.billed.map((r) => r.title)]).toEqual([0, 0, ['Itera - Melhorias', 'Laboratório']]);
    expect(buildNav(DRAFTS, PROJECTS, opts({ filter: 'todo' })).drafts).toHaveLength(1);
  });
});

describe('marksByEpic', () => {
  it('counts picked deliveries per epic', () => {
    expect([...marksByEpic(PROJECTS, new Set(['d-e1', 'd-e3']))]).toEqual([['e1', 1], ['e3', 1]]);
    expect(marksByEpic(PROJECTS, new Set()).size).toBe(0);
  });
});
