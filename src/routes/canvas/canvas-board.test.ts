import { describe, it, expect } from 'vitest';
import { CARD_ID_RE, type CanvasCard, type CanvasGraph } from '../../../shared/canvas';
import { boundSessions, cardRun, mergeBoard, newCardId } from './canvas-board';

const card = (extra: Partial<CanvasCard> = {}): CanvasCard => ({
  id: 'card-1', title: 'T', prompt: 'P', status: 'todo', kind: 'task', contextIds: ['a'], sessionIds: [], createdAt: 1, updatedAt: 2, ...extra,
});
const graph: CanvasGraph = {
  builtAt: 1,
  nodes: [
    { id: 'c:a', kind: 'context', ref: 'a', title: 'a', subtitle: '', mtime: 1 },
    { id: 's:x', kind: 'session', ref: 'x', title: 'x', subtitle: '', mtime: 1 },
    { id: 'k:gone', kind: 'card', ref: 'gone', title: 'old', subtitle: '', mtime: 1 },
  ],
  edges: [
    { source: 'k:card-1', target: 's:x', kind: 'card' },
    { source: 'k:card-1', target: 'c:stale', kind: 'card' },
    { source: 'k:gone', target: 's:x', kind: 'card' },
  ],
};

describe('mergeBoard', () => {
  it('takes cards from the board and keeps only marker-bound session edges from the graph', () => {
    const r = mergeBoard(graph, [card({ title: 'fresh' })]);
    expect(r.nodes.filter((n) => n.kind === 'card').map((n) => n.title)).toEqual(['fresh']);
    expect(r.edges).toEqual([
      { source: 'k:card-1', target: 's:x', kind: 'card' },
      { source: 'k:card-1', target: 'c:a', kind: 'card' },
    ]);
  });

  it('works before the first graph frame', () => {
    expect(mergeBoard(null, [card()]).nodes).toHaveLength(1);
  });
});

describe('cardRun', () => {
  const edges = mergeBoard(graph, [card()]).edges;
  it('reads bound sessions', () => {
    expect(boundSessions(edges, 'card-1')).toEqual(['x']);
  });
  it('running beats review, review needs doing + sessions', () => {
    expect(cardRun(card({ status: 'doing' }), ['x'], new Set(['x']))).toBe('running');
    expect(cardRun(card({ status: 'doing' }), ['x'], new Set())).toBe('review');
    expect(cardRun(card({ status: 'todo' }), ['x'], new Set())).toBe('idle');
    expect(cardRun(card({ status: 'doing' }), [], new Set())).toBe('idle');
  });
});

describe('newCardId', () => {
  it('matches the server id rule', () => {
    expect(CARD_ID_RE.test(newCardId(Date.now(), 0.5))).toBe(true);
    expect(CARD_ID_RE.test(newCardId(0, 0))).toBe(true);
  });
});
