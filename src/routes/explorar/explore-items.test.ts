import { describe, it, expect } from 'vitest';
import { EXPLORE_ITEMS, exploreItemsFor } from './explore-items';

describe('exploreItemsFor', () => {
  it('gives root and admin every item', () => {
    for (const role of ['root', 'admin'] as const) expect(exploreItemsFor(role)).toEqual(EXPLORE_ITEMS);
  });

  it('gives a student nothing', () => {
    expect(exploreItemsFor('student')).toEqual([]);
  });

  it('points each item at its target path', () => {
    expect(Object.fromEntries(EXPLORE_ITEMS.map((i) => [i.id, i.path]))).toEqual({
      mundo: '/equipe/mundo', base: '/base', graph: '/graph', reunioes: '/agentes/reunioes',
      loja: '/agentes/loja', arcade: '/arcade', ds: '/ds', onboarding: '/onboarding',
    });
  });
});
