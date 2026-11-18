import { describe, it, expect } from 'vitest';
import raw from '../../../../public/world/v2/world.tmj?raw';
import homesRaw from '../../../../scripts/team-homes.json?raw';
import {
  V2_TILE_LAYERS, blockedTiles, botId, objects, propsOf, rectOf, tileOf, tilesOfType, validateWorldV2, type Homes, type V2Map,
} from './world-v2-check';

const map = JSON.parse(raw) as V2Map;
// Stage 1 draws only the civic centre; bots whose house is not on the map yet are left out.
const built = new Set(objects(map).map((o) => String(propsOf(o).id)));
const allHomes = JSON.parse(homesRaw) as Homes;
const homes: Homes = Object.fromEntries(Object.entries(allHomes).filter(([, h]) => built.has(h)));
const clone = (): V2Map => JSON.parse(raw) as V2Map;
const find = (m: V2Map, id: string) => objects(m).find((o) => propsOf(o).id === id)!;

describe('world v2 map', () => {
  it('is a 96x64 orthogonal map of 32px tiles under 1.5 MB', () => {
    expect(map.width).toBe(96);
    expect(map.height).toBe(64);
    expect(map.tilewidth).toBe(32);
    expect(map.tileheight).toBe(32);
    expect(new TextEncoder().encode(raw).length).toBeLessThan(1.5 * 1024 * 1024);
  });

  it('passes the validator', () => {
    expect(validateWorldV2(map, homes)).toEqual([]);
  });

  it('embeds both v2 tilesets with consecutive firstgids', () => {
    expect(map.tilesets.map((t) => t.name)).toEqual(['tiles-exterior', 'tiles-interior']);
    expect(map.tilesets[0]!.firstgid).toBe(1);
    expect(map.tilesets[1]!.firstgid).toBe(1 + map.tilesets[0]!.tilecount);
    for (const ts of map.tilesets) expect(ts.image).toMatch(/^tiles-(exterior|interior)\.png$/);
  });

  it('seats 8 around one round table in the meeting room, seat 0 at the head', () => {
    const table = tilesOfType(map, 'furniture_low', 'meeting_round_8');
    const xs = table.map((p) => p.x);
    const ys = table.map((p) => p.y);
    const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    expect(box.x1 - box.x0).toBe(4);
    expect(box.y1 - box.y0).toBe(4);
    const chairs = objects(map).filter((o) => o.point && propsOf(o).room === 'sala');
    expect(chairs.map((c) => propsOf(c).seat).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const c of chairs) {
      const t = tileOf(map, c);
      expect(t.x >= box.x0 && t.x <= box.x1 && t.y >= box.y0 && t.y <= box.y1).toBe(true);
    }
    const head = tileOf(map, chairs.find((c) => propsOf(c).seat === 0)!);
    expect(head).toEqual({ x: box.x0 + 2, y: box.y0 });
    expect(propsOf(chairs.find((c) => propsOf(c).seat === 0)!).face).toBe('down');
    const sala = rectOf(map, find(map, 'sala'));
    expect(box.x0 > sala.x && box.x1 < sala.x + sala.w - 1).toBe(true);
  });

  it('blocks the round table but not the chairs', () => {
    const blocked = blockedTiles(map);
    const table = tilesOfType(map, 'furniture_low', 'meeting_round_8');
    const x0 = Math.min(...table.map((p) => p.x));
    const y0 = Math.min(...table.map((p) => p.y));
    expect(blocked.has((y0 + 2) * map.width + x0 + 2)).toBe(true);
    for (const c of objects(map).filter((o) => o.point && propsOf(o).room === 'sala')) {
      const t = tileOf(map, c);
      expect(blocked.has(t.y * map.width + t.x)).toBe(false);
    }
  });

  it('places the shop and the board on the plaza with two standing spots each', () => {
    const plaza = rectOf(map, objects(map).find((o) => propsOf(o).kind === 'plaza')!);
    for (const id of ['loja', 'quadro']) {
      const r = rectOf(map, find(map, id));
      expect(r.x >= plaza.x && r.y >= plaza.y && r.x + r.w <= plaza.x + plaza.w && r.y + r.h <= plaza.y + plaza.h).toBe(true);
      expect(objects(map).filter((o) => o.point && propsOf(o).room === id)).toHaveLength(2);
    }
  });

  it('has five server towers, a fountain with the bug spot and every tile layer of the GDD', () => {
    expect(objects(map).filter((o) => propsOf(o).kind === 'tower').map((o) => propsOf(o).id).sort()).toEqual(['box1', 'box2', 'box3', 'box4', 'box5']);
    const f = rectOf(map, objects(map).find((o) => propsOf(o).kind === 'fountain')!);
    const bug = tileOf(map, objects(map).find((o) => propsOf(o).kind === 'bug-spot')!);
    expect(bug.x >= f.x && bug.x < f.x + f.w && bug.y >= f.y && bug.y < f.y + f.h).toBe(true);
    for (const n of V2_TILE_LAYERS) expect(map.layers.some((l) => l.name === n)).toBe(true);
  });

  it('names the offending object when a house loses a prop', () => {
    const m = clone();
    const o = find(m, 'prefeitura');
    o.properties = o.properties!.filter((p) => p.name !== 'label');
    expect(validateWorldV2(m, homes)).toContain('house "prefeitura" is missing prop "label"');
  });

  it('reports a door walled shut and a seat on the same tile as another', () => {
    const m = clone();
    const o = find(m, 'prefeitura');
    const p = propsOf(o);
    const walls = m.layers.find((l) => l.name === 'walls')!.data!;
    const blockGid = m.tilesets[0]!.firstgid + m.tilesets[0]!.tiles!.find((t) => t.type === 'cliff_face')!.id;
    walls[(Number(p.doorY) + 1) * m.width + Number(p.doorX)] = blockGid;
    const chairs = objects(m).filter((c) => c.point && propsOf(c).room === 'sala');
    chairs[1]!.x = chairs[0]!.x;
    chairs[1]!.y = chairs[0]!.y;
    const errs = validateWorldV2(m, homes);
    expect(errs.some((e) => e.startsWith('house "prefeitura" has no free tile in front of its door'))).toBe(true);
    expect(errs.some((e) => e.includes('are on the same tile'))).toBe(true);
  });

  it('reports a gid outside the embedded tilesets and a bot without a desk', () => {
    const m = clone();
    m.layers.find((l) => l.name === 'ground')!.data![0] = 99999;
    const errs = validateWorldV2(m, { ...homes, Ghost: 'prefeitura', Ünder: 'escritorio' });
    expect(errs).toContain('tile layer "ground" uses gid 99999 outside every embedded tileset');
    expect(errs).toContain('bot "Ghost" has 0 desks, expected 1');
    expect(errs).toContain('bot "Ünder" lives in house "escritorio", which is not on the map');
    expect(botId('Íris')).toBe('iris');
  });
});
