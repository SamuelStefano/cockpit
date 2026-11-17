import { describe, it, expect } from 'vitest';
import { approachTile, planCarry } from './world-carry';
import { findPath, isBlocked, PLAZA_CENTER } from './world-map';
import { wanderTiles } from './world-wander';

const free = (p: { x: number; y: number }): boolean => !isBlocked(p.x, p.y);

describe('approachTile', () => {
  it('picks the neighbour nearest the sender', () => {
    expect(approachTile({ x: 10, y: 10 }, { x: 0, y: 10 }, () => true)).toMatchObject({ x: 9 });
  });
  it('returns null when boxed in', () => {
    expect(approachTile({ x: 1, y: 1 }, { x: 5, y: 5 }, () => false)).toBeNull();
  });
});

describe('planCarry', () => {
  const tiles = wanderTiles();
  it('walks between two plaza tiles and ends beside the receiver', () => {
    const a = tiles[0]!;
    const b = tiles[tiles.length - 1]!;
    const plan = planCarry(a, b, free, findPath)!;
    expect(plan).not.toBeNull();
    expect(Math.max(Math.abs(plan.adjacent.x - b.x), Math.abs(plan.adjacent.y - b.y))).toBe(1);
    expect(plan.go.at(-1)).toEqual(plan.adjacent);
  });
  it('hands over in place when already adjacent', () => {
    const a = tiles[0]!;
    expect(planCarry(a, { x: a.x + 1, y: a.y }, free, findPath)).toEqual({ go: [], adjacent: a });
  });
  it('falls back when the route is empty or too long', () => {
    const a = tiles[0]!;
    const b = tiles[tiles.length - 1]!;
    expect(planCarry(a, b, free, () => [])).toBeNull();
    expect(planCarry(a, b, free, findPath, 1)).toBeNull();
    expect(planCarry({ x: -5, y: -5 }, PLAZA_CENTER, free, findPath)).toBeNull();
  });
});
