import { describe, it, expect } from 'vitest';
import { AVATAR_SPAWN, HOUSES, MAP_H, MAP_W, PLAZA_CENTER, doorTiles, findPath, isBlocked, nearestFree, plazaSlots } from './world-map';

describe('world map', () => {
  it('blocks the borders and house walls but not the door gap', () => {
    expect(isBlocked(0, 0)).toBe(true);
    expect(isBlocked(MAP_W, 5)).toBe(true);
    const h = HOUSES[0]!;
    expect(isBlocked(h.x, h.y + 3)).toBe(true);
    for (const d of doorTiles(h)) expect(isBlocked(d.x, d.y)).toBe(false);
  });

  it('keeps the spawn and every plaza slot on free tiles', () => {
    expect(isBlocked(AVATAR_SPAWN.x, AVATAR_SPAWN.y)).toBe(false);
    for (const s of plazaSlots(11)) expect(isBlocked(s.x, s.y)).toBe(false);
  });

  it('spreads plaza slots without overlap', () => {
    const slots = plazaSlots(11).map((s) => `${s.x},${s.y}`);
    expect(new Set(slots).size).toBe(11);
  });

  it('walks from the plaza through a door into each house', () => {
    for (const h of HOUSES) {
      const d = doorTiles(h)[0]!;
      const inside = { x: d.x, y: d.y - 2 };
      expect(isBlocked(inside.x, inside.y)).toBe(false);
      const path = findPath(AVATAR_SPAWN, inside);
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual(inside);
      for (const p of path) expect(isBlocked(p.x, p.y)).toBe(false);
    }
  });

  it('never cuts a wall corner on a diagonal step', () => {
    const path = findPath(AVATAR_SPAWN, { x: 5, y: 8 });
    let prev = AVATAR_SPAWN;
    for (const p of path) {
      if (p.x !== prev.x && p.y !== prev.y) {
        expect(isBlocked(p.x, prev.y)).toBe(false);
        expect(isBlocked(prev.x, p.y)).toBe(false);
      }
      prev = p;
    }
  });

  it('resolves a tap on a wall to the nearest free tile', () => {
    const h = HOUSES[1]!;
    const path = findPath(AVATAR_SPAWN, { x: h.x, y: h.y + 3 });
    const end = path[path.length - 1]!;
    expect(isBlocked(end.x, end.y)).toBe(false);
    expect(Math.abs(end.x - h.x)).toBeLessThanOrEqual(4);
  });

  it('gives every house its own furniture set, none on the walls', () => {
    const sets = HOUSES.map((h) => h.items.map((i) => `${i.s}:${i.f}@${i.x},${i.y}`).sort().join('|'));
    expect(new Set(sets).size).toBe(HOUSES.length);
    for (const h of HOUSES) {
      expect(h.items.length).toBeGreaterThan(20);
      for (const i of h.items) {
        expect(i.x).toBeGreaterThan(0);
        expect(i.x).toBeLessThan(h.w - 1);
        expect(i.y).toBeGreaterThan(0);
        expect(i.y).toBeLessThan(h.h - 1);
      }
    }
  });

  it('returns no path for out-of-bounds targets and none when already there', () => {
    expect(findPath(AVATAR_SPAWN, { x: -3, y: 4 })).toEqual([]);
    expect(findPath(AVATAR_SPAWN, AVATAR_SPAWN)).toEqual([]);
    expect(nearestFree({ x: PLAZA_CENTER.x, y: PLAZA_CENTER.y })).not.toBeNull();
    expect(MAP_H).toBeGreaterThan(0);
  });
});
