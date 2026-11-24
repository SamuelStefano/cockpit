import { describe, it, expect } from 'vitest';
import { nudgePills, type PillBox } from './pill-layout';

const box = (id: string, x: number, y: number, w = 30, h = 10): PillBox => ({ id, x, y, w, h });
const hit = (a: PillBox, b: PillBox) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

describe('nudgePills', () => {
  it('leaves separated pills where they are', () => {
    const r = nudgePills([box('a', 0, 0), box('b', 100, 0)]);
    expect([...r.values()]).toEqual([0, 0]);
  });

  it('lifts a pill that overlaps another so none overlap', () => {
    const boxes = [box('a', 0, 0), box('b', 10, 2), box('c', 20, 4), box('d', 5, -3)];
    const r = nudgePills(boxes);
    const moved = boxes.map((b) => ({ ...b, y: b.y - (r.get(b.id) ?? 0) }));
    for (let i = 0; i < moved.length; i++) for (let j = i + 1; j < moved.length; j++) expect(hit(moved[i]!, moved[j]!)).toBe(false);
  });

  it('is deterministic whatever the input order', () => {
    const boxes = [box('a', 0, 0), box('b', 10, 0), box('c', 5, 1)];
    const a = nudgePills(boxes);
    const b = nudgePills([...boxes].reverse());
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });
});
