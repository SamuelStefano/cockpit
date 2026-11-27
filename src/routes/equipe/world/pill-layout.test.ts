import { describe, it, expect } from 'vitest';
import { nudgePills, type PillBox, type PillOffset } from './pill-layout';

const box = (id: string, x: number, y: number, w = 30, h = 10, fixed = false): PillBox => ({ id, x, y, w, h, ...(fixed ? { fixed } : {}) });
const moved = (boxes: PillBox[], r: Map<string, PillOffset>): PillBox[] =>
  boxes.map((b) => ({ ...b, x: b.x + (r.get(b.id)?.dx ?? 0), y: b.y + (r.get(b.id)?.dy ?? 0) }));
const hit = (a: PillBox, b: PillBox) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
const anyOverlap = (list: PillBox[]) => list.some((a, i) => list.slice(i + 1).some((b) => hit(a, b)));

describe('nudgePills', () => {
  it('leaves separated pills where they are', () => {
    const r = nudgePills([box('a', 0, 0), box('b', 100, 0)]);
    expect([...r.values()].map((o) => [o.dx, o.dy])).toEqual([[0, 0], [0, 0]]);
  });

  it('separates a small stack', () => {
    const boxes = [box('a', 0, 0), box('b', 10, 2), box('c', 20, 4), box('d', 5, -3)];
    expect(anyOverlap(moved(boxes, nudgePills(boxes)))).toBe(false);
  });

  it('separates a crowded plaza of bots within 20 px', () => {
    const boxes = ['usopp', 'lorena', 'deck', 'mari', 'malu', 'robin', 'lara', 'otto', 'iris', 'raquel'].map((id, i) => box(id, 100 + (i % 5) * 4, 80 + (i % 3) * 2, 28 + (i % 4) * 4));
    expect(anyOverlap(moved(boxes, nudgePills(boxes)))).toBe(false);
  });

  it('keeps fixed pills still and moves bots around them', () => {
    const boxes = [box('house', 100, 80, 40, 10, true), box('sign', 110, 82, 30, 10, true), box('bot', 105, 81), box('bot2', 108, 80)];
    const r = nudgePills(boxes);
    expect(r.get('house')).toMatchObject({ dx: 0, dy: 0 });
    expect(r.get('sign')).toMatchObject({ dx: 0, dy: 0 });
    const out = moved(boxes.filter((b) => !b.fixed), r).concat(boxes.filter((b) => b.fixed));
    expect(out.filter((b) => !b.fixed).every((b) => out.filter((o) => o !== b).every((o) => !hit(b, o)))).toBe(true);
  });

  it('is deterministic whatever the input order', () => {
    const boxes = [box('a', 0, 0), box('b', 10, 0), box('c', 5, 1)];
    const a = nudgePills(boxes);
    const b = nudgePills([...boxes].reverse());
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it('does not depend on screen order while bots walk', () => {
    const at = (ax: number) => [box('a', ax, 0), box('b', 100, 0), box('c', 104, 1)];
    expect(nudgePills(at(0)).get('c')).toEqual(nudgePills(at(300)).get('c'));
  });

  it('keeps a lifted pill lifted until it clears by a margin', () => {
    const b = [box('a', 0, 0), box('b', 0, 0)];
    const first = nudgePills(b);
    const slot = first.get('b')!.slot;
    expect(slot).toBeGreaterThan(0);
    const edge = [box('a', 0, 0), box('b', 31.5, 0)];
    expect(nudgePills(edge, new Map([['b', slot]])).get('b')!.slot).toBeGreaterThan(0);
    expect(nudgePills(edge).get('b')!.slot).toBe(0);
  });

  it('goes sideways or past one column when stacked deep', () => {
    const boxes = Array.from({ length: 40 }, (_, i) => box(`b${String(i).padStart(2, '0')}`, 50, 50));
    expect(anyOverlap(moved(boxes, nudgePills(boxes)))).toBe(false);
  });
});
