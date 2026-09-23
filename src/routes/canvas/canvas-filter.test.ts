import { describe, it, expect } from 'vitest';
import type { CanvasCard, CanvasEdge, CanvasNode } from '../../../shared/canvas';
import { ACTIVE_WINDOW_MS, filterCanvas, neighbors } from './canvas-filter';

const NOW = 100 * ACTIVE_WINDOW_MS;
const n = (id: string, kind: CanvasNode['kind'], extra: Partial<CanvasNode> = {}): CanvasNode =>
  ({ id, kind, ref: id.slice(2), title: id, subtitle: '', mtime: NOW, ...extra });

const nodes = [
  n('c:hub_a', 'context', { hub: true }), n('c:leaf', 'context'), n('c:other', 'context'),
  n('s:fresh', 'session'), n('s:old', 'session', { mtime: 0 }), n('s:arch', 'session', { archived: true }),
  n('k:open', 'card'),
];
const edges: CanvasEdge[] = [
  { source: 'c:hub_a', target: 'c:leaf', kind: 'link' },
  { source: 's:fresh', target: 'c:leaf', kind: 'read' },
  { source: 's:old', target: 'c:other', kind: 'read' },
  { source: 's:arch', target: 'c:other', kind: 'write' },
];
const card = { id: 'open', status: 'todo' } as CanvasCard;
const base = { scope: 'active' as const, archived: false, query: '', running: new Set<string>(), cards: [card], now: NOW };
const ids = (r: { nodes: CanvasNode[] }) => r.nodes.map((x) => x.id).sort();

describe('filterCanvas', () => {
  it('active scope keeps recent sessions, their contexts, hubs above and open cards', () => {
    expect(ids(filterCanvas(nodes, edges, base))).toEqual(['c:hub_a', 'c:leaf', 'k:open', 's:fresh']);
  });

  it('a running old session counts as active', () => {
    expect(ids(filterCanvas(nodes, edges, { ...base, running: new Set(['old']) }))).toContain('s:old');
  });

  it('all scope hides archived unless asked', () => {
    expect(ids(filterCanvas(nodes, edges, { ...base, scope: 'all' }))).not.toContain('s:arch');
    expect(ids(filterCanvas(nodes, edges, { ...base, scope: 'all', archived: true }))).toContain('s:arch');
  });

  it('query keeps matches plus their visible neighbors', () => {
    const r = filterCanvas(nodes, edges, { ...base, scope: 'all', query: 'leaf' });
    expect(ids(r)).toEqual(['c:hub_a', 'c:leaf', 's:fresh']);
    expect(r.edges).toHaveLength(2);
  });
});

describe('neighbors', () => {
  it('is undirected', () => {
    expect([...neighbors(edges, 'c:leaf')].sort()).toEqual(['c:hub_a', 's:fresh']);
  });
});
