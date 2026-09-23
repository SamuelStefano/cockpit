import { describe, it, expect } from 'vitest';
import type { CanvasNode } from '../../../shared/canvas';
import { computeAreaRects } from './canvas-areas';
import { NODE_H, NODE_W } from './canvas-layout';
import { TERM_H, TERM_W } from './canvas-terms';

const n = (id: string, kind: CanvasNode['kind'], area: CanvasNode['area'], extra: Partial<CanvasNode> = {}): CanvasNode =>
  ({ id, kind, ref: id.slice(2), title: id, subtitle: '', mtime: 1, area, ...extra });

describe('computeAreaRects', () => {
  it('makes one rect per area, bounding its members plus padding', () => {
    const nodes = [n('c:hub_deck', 'context', 'deck'), n('c:deck_leaf', 'context', 'deck')];
    const pos = { 'c:hub_deck': { x: 0, y: 0 }, 'c:deck_leaf': { x: 300, y: 100 } };
    const [rect] = computeAreaRects(nodes, pos, new Set(), new Set());
    expect(rect.area).toBe('deck');
    expect(rect.x).toBeLessThan(0);
    expect(rect.y).toBeLessThan(0);
    expect(rect.x + rect.w).toBeGreaterThan(300 + NODE_W);
    expect(rect.y + rect.h).toBeGreaterThan(100 + NODE_H);
  });

  // Regression (review #595 second pass, point 3): trimmedExtent used to skip
  // sorting below the trim threshold and pick straight off `values`, which
  // `pick` (s[0]/s[length-1]) assumes is ascending. With the members inserted
  // in DESCENDING x order (the rightmost node first), the untrimmed pick
  // could put the "left" edge to the right of the "right" edge — a negative
  // width.
  it('never yields a negative width/height for 2 members inserted in descending order', () => {
    const nodes = [n('c:right', 'context', 'dfl'), n('c:left', 'context', 'dfl')];
    const pos = { 'c:right': { x: 500, y: 500 }, 'c:left': { x: 0, y: 0 } };
    const [rect] = computeAreaRects(nodes, pos, new Set(), new Set());
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
    expect(rect.x).toBeLessThanOrEqual(0);
    expect(rect.x + rect.w).toBeGreaterThanOrEqual(500 + NODE_W);
  });

  it('keeps two areas as two separate rects', () => {
    const nodes = [n('c:a', 'context', 'dfl'), n('c:b', 'context', 'deck')];
    const pos = { 'c:a': { x: 0, y: 0 }, 'c:b': { x: 1000, y: 1000 } };
    const rects = computeAreaRects(nodes, pos, new Set(), new Set());
    expect(rects.map((r) => r.area).sort()).toEqual(['deck', 'dfl']);
  });

  it('skips a node with no area and a node with no known position', () => {
    const nodes = [n('c:a', 'context', undefined), n('c:b', 'context', 'dfl'), n('c:missing', 'context', 'dfl')];
    const pos = { 'c:b': { x: 0, y: 0 } };
    const rects = computeAreaRects(nodes, pos, new Set(), new Set());
    expect(rects).toHaveLength(1);
    expect(rects[0].sessions).toBe(0);
  });

  it('counts sessions, running sessions and open terminals within the area', () => {
    const nodes = [
      n('s:one', 'session', 'dfl'), n('s:two', 'session', 'dfl'), n('c:ctx', 'context', 'dfl'),
    ];
    const pos = { 's:one': { x: 0, y: 0 }, 's:two': { x: 300, y: 0 }, 'c:ctx': { x: 600, y: 0 } };
    const rect = computeAreaRects(nodes, pos, new Set(['one']), new Set(['s:two']))[0];
    expect(rect.sessions).toBe(2);
    expect(rect.running).toBe(1);
    expect(rect.terminals).toBe(1);
  });

  it('sizes an open window as TERM_W×TERM_H, not the small node-card footprint', () => {
    const nodes = [n('s:one', 'session', 'dfl')];
    const pos = { 's:one': { x: 0, y: 0 } };
    const closed = computeAreaRects(nodes, pos, new Set(), new Set())[0];
    const open = computeAreaRects(nodes, pos, new Set(), new Set(['s:one']))[0];
    expect(open.w).toBeGreaterThan(closed.w);
    expect(open.w).toBeGreaterThanOrEqual(TERM_W);
    expect(open.h).toBeGreaterThanOrEqual(TERM_H);
    expect(closed.w).toBeLessThan(TERM_W);
  });

  it('returns nothing when no node carries an area', () => {
    expect(computeAreaRects([n('c:a', 'context', undefined)], { 'c:a': { x: 0, y: 0 } }, new Set(), new Set())).toEqual([]);
  });

  it('a single dragged-far node does not stretch the region across the whole map (5+ members)', () => {
    const cluster = [0, 1, 2, 3, 4].map((i) => n(`c:m${i}`, 'context', 'dfl'));
    const pos: Record<string, { x: number; y: number }> = {};
    cluster.forEach((c, i) => { pos[c.id] = { x: i * 40, y: i * 20 }; }); // tight cluster near the origin
    const outlier = n('c:outlier', 'context', 'dfl');
    const posWithOutlier = { ...pos, [outlier.id]: { x: 6000, y: 4000 } }; // dragged far away
    const tight = computeAreaRects(cluster, pos, new Set(), new Set())[0];
    const withOutlier = computeAreaRects([...cluster, outlier], posWithOutlier, new Set(), new Set())[0];
    // The outlier is trimmed off the edge computation: the box barely grows.
    expect(withOutlier.w).toBeLessThan(tight.w + 400);
    expect(withOutlier.x + withOutlier.w).toBeLessThan(2000); // nowhere near the outlier's 6000
  });

  it('a small cluster (under the trim threshold) is NOT trimmed — every member still fits', () => {
    const nodes = [0, 1, 2, 3].map((i) => n(`c:m${i}`, 'context', 'dfl'));
    const pos: Record<string, { x: number; y: number }> = {};
    nodes.forEach((c, i) => { pos[c.id] = { x: i === 3 ? 5000 : i * 10, y: 0 }; }); // one far outlier among only 4
    const rect = computeAreaRects(nodes, pos, new Set(), new Set())[0];
    expect(rect.x + rect.w).toBeGreaterThan(5000); // too few members to trim: the outlier still counts
  });
});
