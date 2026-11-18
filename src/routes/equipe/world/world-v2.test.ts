import { describe, it, expect } from 'vitest';
import raw from '../../../../public/world/v2/world.tmj?raw';
import homesRaw from '../../../../scripts/team-homes.json?raw';
import {
  V2_TILE_LAYERS, blockedTiles, botId, objects, propsOf, rectOf, tileOf, tilesOfType, validateWorldV2, type Homes, type V2Map,
} from './world-v2-check';

const map = JSON.parse(raw) as V2Map;
// Every house is on the map now, so every bot in the file is checked.
const allHomes = (JSON.parse(homesRaw) as { homes: Homes }).homes;
const homes: Homes = allHomes;
const clone = (): V2Map => JSON.parse(raw) as V2Map;
const find = (m: V2Map, id: string) => objects(m).find((o) => propsOf(o).id === id)!;

describe('team-homes.json', () => {
  it('lists the 21 bots, one seat each per house, with a desk on the map for every built house', () => {
    const slugs = Object.keys(allHomes);
    expect(slugs).toHaveLength(21);
    for (const s of slugs) expect(s).toBe(botId(s));
    const seats = Object.values(allHomes).map((h) => `${h.house}#${h.seat}`);
    expect(new Set(seats).size).toBe(seats.length);
    const desks = objects(map).filter((o) => o.point && propsOf(o).kind === undefined && propsOf(o).bot !== undefined);
    expect(Object.keys(homes).length).toBeGreaterThan(0);
    for (const [slug, h] of Object.entries(homes)) {
      const mine = desks.filter((d) => propsOf(d).bot === slug);
      expect(mine).toHaveLength(1);
      expect(propsOf(mine[0]!).project).toBe(h.house);
      expect(propsOf(mine[0]!).seat).toBe(h.seat);
    }
  });
});

describe('world v2 map', () => {
  it('is a 96x64 orthogonal map of 32px tiles under 1.5 MB', () => {
    expect(map.width).toBe(96);
    expect(map.height).toBe(64);
    expect(map.tilewidth).toBe(32);
    expect(map.tileheight).toBe(32);
    expect(new TextEncoder().encode(raw).length).toBeLessThan(1.5 * 1024 * 1024);
  });

  it('builds a house for every home in team-homes.json and staffs every house but the library', () => {
    const ids = new Set(objects(map).map((o) => String(propsOf(o).id)));
    const missing = Object.entries(homes).filter(([, h]) => !ids.has(h.house)).map(([n, h]) => `bot "${n}" lives in house "${h.house}", which is not on the map`);
    expect(missing).toEqual([]);
    const staffed = new Set(Object.values(homes).map((h) => h.house));
    const empty = objects(map).filter((o) => propsOf(o).kind === 'house' && propsOf(o).id !== 'biblioteca' && !staffed.has(String(propsOf(o).id)))
      .map((o) => `house "${String(propsOf(o).id)}" has no bot in team-homes.json`);
    expect(empty).toEqual([]);
    expect(Object.keys(homes)).toHaveLength(21);
  });

  it('passes the validator', () => {
    expect(validateWorldV2(map, homes)).toEqual([]);
  });

  it('embeds the v2 tilesets with consecutive firstgids', () => {
    expect(map.tilesets.map((t) => t.name)).toEqual(['tiles-exterior', 'tiles-interior', 'tiles-extra']);
    expect(map.tilesets[0]!.firstgid).toBe(1);
    for (let i = 1; i < map.tilesets.length; i++) expect(map.tilesets[i]!.firstgid).toBe(map.tilesets[i - 1]!.firstgid + map.tilesets[i - 1]!.tilecount);
    for (const ts of map.tilesets) expect(ts.image).toMatch(/^tiles-(exterior|interior|extra)\.png$/);
  });

  it('gives every house a name sign on its facade and the project houses a PR counter slot', () => {
    const houses = objects(map).filter((o) => propsOf(o).kind === 'house');
    const signs = objects(map).filter((o) => propsOf(o).kind === 'sign');
    const slots = objects(map).filter((o) => propsOf(o).kind === 'pr-slot');
    const within = (o: typeof houses[number], r: ReturnType<typeof rectOf>): boolean =>
      o.x >= r.x * 32 && o.y >= (r.y - 6) * 32 && o.x + o.width <= (r.x + r.w) * 32 && o.y + o.height <= (r.y + r.h) * 32;
    const noSign = houses.filter((h) => !signs.some((s) => propsOf(s).house === propsOf(h).id && within(s, rectOf(map, h))))
      .map((h) => `house "${String(propsOf(h).id)}" has no sign`);
    expect(noSign).toEqual([]);
    for (const id of ['itera', 'dfl', 'deck', 'qa', 'corte-radar']) {
      const slot = slots.find((o) => propsOf(o).house === id);
      expect(slot, `house "${id}" has no pr-slot`).toBeDefined();
      expect([slot!.width, slot!.height]).toEqual([14, 9]);
      expect(within(slot!, rectOf(map, find(map, id)))).toBe(true);
    }
    const layers = ['walls', 'furniture_high'].map((n) => map.layers.find((l) => l.name === n)!.data!);
    const extra = map.tilesets.find((t) => t.name === 'tiles-extra')!;
    for (const s of signs.filter((o) => !propsOf(o).builtin)) {
      const g = layers.map((d) => d[Math.floor((s.y + 4) / 32) * map.width + Math.floor((s.x + 4) / 32)]!);
      expect(g.some((v) => v >= extra.firstgid && v < extra.firstgid + extra.tilecount), `sign of "${String(propsOf(s).house)}" has no sign tiles`).toBe(true);
    }
  });

  it('draws Corte Radar as a vertical landmark taller than wide', () => {
    const r = rectOf(map, find(map, 'corte-radar'));
    expect(r.h).toBeGreaterThan(r.w);
    const tower = tilesOfType(map, 'furniture_high', 'radar_tower');
    const ys = tower.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys) + 1).toBeGreaterThanOrEqual(6);
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

  it('has a pier with two boats and the PORTO sign', () => {
    const pier = rectOf(map, objects(map).find((o) => propsOf(o).kind === 'pier')!);
    expect(objects(map).filter((o) => propsOf(o).kind === 'boat')).toHaveLength(2);
    const sign = objects(map).find((o) => propsOf(o).kind === 'dock-sign')!;
    expect(propsOf(sign).image).toBe('fx/porto-sign.png');
    const blocked = blockedTiles(map);
    for (let y = pier.y; y < pier.y + pier.h - 1; y++) expect(blocked.has(y * map.width + pier.x)).toBe(false);
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
    const errs = validateWorldV2(m, { ...homes, ghost: { house: 'prefeitura', seat: 1 }, under: { house: 'escritorio', seat: 0 } });
    expect(errs).toContain('tile layer "ground" uses gid 99999 outside every embedded tileset');
    expect(errs).toContain('bot "ghost" has 0 desks, expected 1');
    expect(errs).toContain('bot "under" lives in house "escritorio", which is not on the map');
    expect(botId('Íris')).toBe('iris');
  });
});
