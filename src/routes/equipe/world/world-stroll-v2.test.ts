import { describe, it, expect } from 'vitest';
import raw from '../../../../public/world/v2/world.tmj?raw';
import homesRaw from '../../../../scripts/team-homes.json?raw';
import { BREAK_AFTER_MS, FIRST_JITTER_MS, firstStrollStart, plazaBreakers } from './world-break';
import { blockedTiles, objects, propsOf, tileOf, type Homes, type V2Map } from './world-v2-check';

const MIN = 60_000;
const TILE_PX = 32;
const WALK_PX_PER_S = 144;
const map = JSON.parse(raw) as V2Map;
const homes = (JSON.parse(homesRaw) as { homes: Homes }).homes;
const slugs = Object.keys(homes);

function distances(from: number): Map<number, number> {
  const blocked = blockedTiles(map);
  const dist = new Map<number, number>([[from, 0]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    const cx = cur % map.width;
    const cy = Math.floor(cur / map.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const k = ny * map.width + nx;
      if (dist.has(k) || blocked.has(k)) continue;
      dist.set(k, dist.get(cur)! + 1);
      queue.push(k);
    }
  }
  return dist;
}

describe('plaza strolls on the 128x80 map', () => {
  const plazaSpawn = objects(map).find((o) => propsOf(o).kind === 'plaza-spawn' && propsOf(o).role === 'center')!;
  const centre = tileOf(map, plazaSpawn);
  const fromPlaza = distances(centre.y * map.width + centre.x);
  const desks = objects(map).filter((o) => o.point && propsOf(o).kind === undefined && typeof propsOf(o).bot === 'string');

  it('is 128x80 and the 21 bots all have a desk that reaches the plaza', () => {
    expect([map.width, map.height]).toEqual([128, 80]);
    expect(slugs).toHaveLength(21);
    for (const slug of slugs) {
      const d = desks.find((o) => propsOf(o).bot === slug)!;
      const t = tileOf(map, d);
      expect(fromPlaza.has(t.y * map.width + t.x)).toBe(true);
    }
  });

  it('walks from the farthest desk to the plaza well inside a 20 s stroll', () => {
    let worst = 0;
    for (const d of desks) {
      const t = tileOf(map, d);
      const tiles = fromPlaza.get(t.y * map.width + t.x);
      if (tiles !== undefined) worst = Math.max(worst, (tiles * TILE_PX) / WALK_PX_PER_S);
    }
    expect(worst).toBeLessThan(20);
  });

  it('starts every first stroll within 10 minutes after the 30 minute mark', () => {
    for (const slug of slugs) {
      const s = firstStrollStart(0, slug);
      expect(s).toBeGreaterThanOrEqual(BREAK_AFTER_MS);
      expect(s).toBeLessThanOrEqual(BREAK_AFTER_MS + FIRST_JITTER_MS);
      expect(FIRST_JITTER_MS).toBeLessThanOrEqual(10 * MIN);
    }
  });

  it('never has more than 4 of the 21 idle bots on the plaza over 3 hours', () => {
    const idle = slugs.map((id) => ({ id, idleSince: 0 }));
    let max = 0;
    for (let now = 0; now <= 3 * 60 * MIN; now += 5000) max = Math.max(max, plazaBreakers(now, idle).size);
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(4);
  });
});
