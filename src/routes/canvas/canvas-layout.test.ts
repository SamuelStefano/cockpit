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
});

describe('bounds', () => {
  it('covers node boxes', () => {
    expect(bounds([{ x: 0, y: 0 }, { x: 100, y: 50 }]).w).toBeGreaterThan(100);
    expect(bounds([])).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
