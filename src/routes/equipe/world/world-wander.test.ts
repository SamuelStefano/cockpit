import { describe, it, expect } from 'vitest';
import { WANDER_MAX_MS, WANDER_MIN_MS, hashId, pickWanderTile, tileKey, wanderDelay, wanderTiles } from './world-wander';
import { HOUSES, PLAZA, findPath, isBlocked, outsideDoor } from './world-map';

describe('wanderDelay', () => {
  it('stays in the window and is deterministic', () => {
    for (let n = 0; n < 50; n++) {
      const d = wanderDelay('iris', n);
      expect(d).toBeGreaterThanOrEqual(WANDER_MIN_MS);
      expect(d).toBeLessThanOrEqual(WANDER_MAX_MS);
      expect(wanderDelay('iris', n)).toBe(d);
    }
  });
  it('jitters per bot', () => {
    const ds = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => wanderDelay(id, 0)));
    expect(ds.size).toBeGreaterThan(3);
    expect(hashId('a')).not.toBe(hashId('b'));
  });
});

describe('wanderTiles', () => {
  const tiles = wanderTiles();
  it('stays inside the plaza on free tiles', () => {
    expect(tiles.length).toBeGreaterThan(10);
    for (const t of tiles) {
      expect(isBlocked(t.x, t.y)).toBe(false);
      expect(t.x >= PLAZA.x0 && t.x <= PLAZA.x1 && t.y >= PLAZA.y0 && t.y <= PLAZA.y1).toBe(true);
    }
  });
  it('keeps clear of every door', () => {
    const set = new Set(tiles.map(tileKey));
    for (const h of HOUSES) {
      for (const d of h.doors) {
        const o = outsideDoor({ ...h, doors: [d] });
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) expect(set.has(`${o.x + dx},${o.y + dy}`)).toBe(false);
      }
    }
  });
  it('every tile is reachable from the first', () => {
    const a = tiles[0]!;
    for (const t of tiles.slice(1)) expect(findPath(a, t).length).toBeGreaterThan(0);
  });
});

describe('pickWanderTile', () => {
  const tiles = wanderTiles();
  const from = tiles[0]!;
  it('is deterministic per bot and step', () => {
    expect(pickWanderTile('x', 1, from, tiles, new Set())).toEqual(pickWanderTile('x', 1, from, tiles, new Set()));
  });
  it('never picks an occupied tile', () => {
    const occupied = new Set(tiles.map(tileKey));
    expect(pickWanderTile('x', 1, from, tiles, occupied)).toBeNull();
    const free = tiles[tiles.length - 1]!;
    occupied.delete(tileKey(free));
    const got = pickWanderTile('x', 1, free, tiles, occupied);
    expect(got === null || !occupied.has(tileKey(got))).toBe(true);
  });
  it('moves at least two tiles', () => {
    for (let n = 0; n < 30; n++) {
      const p = pickWanderTile('y', n, from, tiles, new Set())!;
      expect(Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y))).toBeGreaterThanOrEqual(2);
    }
  });
});
