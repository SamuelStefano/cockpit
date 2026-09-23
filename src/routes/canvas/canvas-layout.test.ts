import { describe, it, expect } from 'vitest';
import type { CanvasEdge, CanvasNode } from '../../../shared/canvas';
import { bounds, layoutCanvas } from './canvas-layout';

const n = (id: string, kind: CanvasNode['kind'], extra: Partial<CanvasNode> = {}): CanvasNode =>
  ({ id, kind, ref: id.slice(2), title: id, subtitle: '', mtime: 1, ...extra });

const nodes = [
  n('c:hub_a', 'context', { hub: true }), n('c:leaf', 'context'), n('c:loose', 'context'),
  n('s:one', 'session'), n('s:lonely', 'session'), n('k:card', 'card'),
];
const edges: CanvasEdge[] = [
  { source: 'c:hub_a', target: 'c:leaf', kind: 'link' },
  { source: 's:one', target: 'c:leaf', kind: 'write' },
  { source: 'k:card', target: 'c:leaf', kind: 'card' },
];

describe('layoutCanvas', () => {
  it('places every node, deterministically', () => {
    const a = layoutCanvas(nodes, edges, {});
    expect(Object.keys(a).sort()).toEqual(nodes.map((x) => x.id).sort());
    expect(layoutCanvas(nodes, edges, {})).toEqual(a);
  });

  it('keeps a leaf near its hub and a card above what it binds', () => {
    const p = layoutCanvas(nodes, edges, {});
    const d = Math.hypot(p['c:leaf'].x - p['c:hub_a'].x, p['c:leaf'].y - p['c:hub_a'].y);
    expect(d).toBeLessThan(600);
    expect(p['k:card'].y).toBeLessThan(p['c:leaf'].y);
  });

  it('puts sessions without context in the side column', () => {
    const p = layoutCanvas(nodes, edges, {});
    expect(p['s:lonely'].x).toBeLessThan(p['c:hub_a'].x);
  });

  it('lets a saved position win', () => {
    expect(layoutCanvas(nodes, edges, { 's:one': { x: 5, y: 6 } })['s:one']).toEqual({ x: 5, y: 6 });
  });

  it('does not reshuffle when a memory write only bumps mtime (review #5)', () => {
    const bumped = nodes.map((n) => (n.id === 'c:leaf' ? { ...n, mtime: 999 } : n));
    const before = layoutCanvas(nodes, edges, {});
    const after = layoutCanvas(bumped, edges, {});
    expect(after).toEqual(before);
  });

  it('does not reshuffle an unrelated sibling when a session becomes active (review #5)', () => {
    const more = [...nodes, n('c:leaf2', 'context'), n('s:two', 'session')];
    const moreEdges: CanvasEdge[] = [...edges, { source: 'c:hub_a', target: 'c:leaf2', kind: 'link' }, { source: 's:two', target: 'c:leaf2', kind: 'write' }];
    const before = layoutCanvas(more, moreEdges, {});
    const bumped = more.map((x) => (x.id === 's:two' ? { ...x, mtime: 999 } : x));
    const after = layoutCanvas(bumped, moreEdges, {});
    expect(after['c:leaf']).toEqual(before['c:leaf']);
    expect(after['s:one']).toEqual(before['s:one']);
  });
});

describe('bounds', () => {
  it('covers node boxes', () => {
    expect(bounds([{ x: 0, y: 0 }, { x: 100, y: 50 }]).w).toBeGreaterThan(100);
    expect(bounds([])).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
