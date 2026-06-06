import { describe, it, expect } from 'vitest';
import { countByType, filterContexts } from './contextos.filter';
import type { ContextMeta } from '../../shared/protocol';

const ctx = (over: Partial<ContextMeta>): ContextMeta => ({
  id: 'x', title: '', description: '', type: 'user', mtime: 0, ...over,
});

const items: ContextMeta[] = [
  ctx({ id: 'a', title: 'Roadmap setup', description: 'ordem das skills', type: 'project' }),
  ctx({ id: 'b', title: 'PR learnings', description: 'pipeline de revisão', type: 'feedback' }),
  ctx({ id: 'c', title: 'User role', description: 'quem é o user', type: 'user' }),
  ctx({ id: 'd', title: 'Infisical', description: 'secrets', type: 'project' }),
];

describe('countByType', () => {
  it('tallies each type', () => {
    expect(countByType(items)).toEqual({ project: 2, feedback: 1, user: 1 });
  });

  it('returns {} for an empty list', () => {
    expect(countByType([])).toEqual({});
  });
});

describe('filterContexts', () => {
  it('returns everything when no query and no type', () => {
    expect(filterContexts(items, '  ', null)).toHaveLength(4);
  });

  it('filters by type', () => {
    expect(filterContexts(items, '', 'project').map((c) => c.id)).toEqual(['a', 'd']);
  });

  it('matches query across title, description and type, case-insensitive', () => {
    expect(filterContexts(items, 'SECRETS', null).map((c) => c.id)).toEqual(['d']);
    expect(filterContexts(items, 'feedback', null).map((c) => c.id)).toEqual(['b']);
  });

  it('combines type and query', () => {
    expect(filterContexts(items, 'roadmap', 'project').map((c) => c.id)).toEqual(['a']);
    expect(filterContexts(items, 'roadmap', 'feedback')).toEqual([]);
  });
});
