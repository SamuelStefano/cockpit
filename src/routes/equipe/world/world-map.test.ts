import { describe, it, expect } from 'vitest';
import worldRaw from '../../../../public/world/world.tmj?raw';
import {
  AVATAR_SPAWN, HOUSES, MAP_H, MAP_W, PLAZA_CENTER, WORLD, doorTiles, insideDoor, outsideDoor, seatTile, findPath, isBlocked, nearestFree, plazaSlots,
  loadWorld, parseWorldMap, validateWorldMap, type TiledMap,
} from './world-map';

// Values captured from the previous hardcoded map (absolute tiles), to prove the move to Tiled kept the layout.
const OLD: Record<string, { blocked: string[]; seats: string[] }> = {
  'itera': {
    blocked: [
      '2,2 3,2 4,2 5,2 6,2 7,2 8,2 9,2 10,2 11,2 2,3 3,3 4,3 5,3 8,3 9,3 10,3 11,3 2,4 3,4 4,4 5,4 9,4 10,4',
      '11,4 2,5 3,5 10,5 11,5 2,6 3,6 5,6 6,6 8,6 9,6 10,6 11,6 2,7 3,7 5,7 6,7 8,7 9,7 10,7 11,7 2,8 11,8',
      '2,9 3,9 10,9 11,9 2,10 3,10 4,10 5,10 8,10 9,10 10,10 11,10',
    ].join(' ').split(' '),
    seats: ['5,8,up', '9,8,up', '6,8,up', '8,8,up'],
  },
  'dfl': {
    blocked: [
      '15,2 16,2 17,2 18,2 19,2 20,2 21,2 22,2 23,2 24,2 15,3 21,3 22,3 23,3 24,3 15,4 16,4 17,4 22,4 23,4',
      '24,4 15,5 16,5 17,5 20,5 23,5 24,5 15,6 16,6 17,6 24,6 15,7 16,7 17,7 24,7 15,8 18,8 21,8 22,8 24,8',
      '15,9 16,9 18,9 21,9 22,9 23,9 24,9 15,10 16,10 17,10 18,10 21,10 22,10 23,10 24,10',
    ].join(' ').split(' '),
    seats: ['18,4,left', '18,6,left', '20,8,right', '23,8,left'],
  },
  'corte-radar': {
    blocked: [
      '28,2 29,2 30,2 31,2 32,2 33,2 34,2 35,2 36,2 37,2 28,3 34,3 35,3 36,3 37,3 28,4 35,4 36,4 37,4 28,5',
      '29,5 30,5 31,5 32,5 33,5 36,5 37,5 28,6 29,6 30,6 31,6 36,6 37,6 28,7 36,7 37,7 28,8 34,8 35,8 37,8',
      '28,9 29,9 36,9 37,9 28,10 29,10 30,10 31,10 34,10 35,10 36,10 37,10',
    ].join(' ').split(' '),
    seats: ['29,7,up', '30,7,up', '31,7,up', '32,7,up'],
  },
  'escritorio': {
    blocked: [
      '3,16 4,16 5,16 6,16 7,16 8,16 9,16 10,16 11,16 3,17 4,17 8,17 9,17 10,17 11,17 3,18 4,18 9,18 10,18',
      '11,18 3,19 4,19 5,19 7,19 8,19 3,20 4,20 5,20 7,20 8,20 3,21 10,21 11,21 3,22 4,22 10,22 11,22 3,23',
      '4,23 5,23 6,23 7,23 8,23 9,23 10,23 11,23',
    ].join(' ').split(' '),
    seats: ['4,21,up', '7,21,up', '5,21,up', '8,21,up'],
  },
};

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
      const inside = insideDoor(h);
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

  it('keeps every originally blocked tile and every seat of the original five buildings (interiors may only gain furniture)', () => {
    for (const [id, old] of Object.entries(OLD)) {
      const h = HOUSES.find((x) => x.id === id)!;
      const blocked: string[] = [];
      for (let y = h.y; y < h.y + h.h; y++) for (let x = h.x; x < h.x + h.w; x++) if (isBlocked(x, y)) blocked.push(`${x},${y}`);
      expect(blocked, id).toEqual(expect.arrayContaining(old.blocked));
      expect(h.seats.map((s) => `${seatTile(h, s).x},${seatTile(h, s).y},${s.face}`), id).toEqual(old.seats);
    }
  });

  it('adds the deck house with two seats, mapped from project deck', () => {
    const h = HOUSES.find((x) => x.id === 'deck')!;
    expect(h.label).toBe('Deck');
    expect(h.seats).toHaveLength(2);
  });

  it('puts every seat on a free, reachable tile inside its building', () => {
    for (const h of HOUSES) {
      expect(h.seats.length).toBeGreaterThanOrEqual(2);
      for (const seat of h.seats) {
        const t = seatTile(h, seat);
        expect(isBlocked(t.x, t.y)).toBe(false);
        expect(findPath(outsideDoor(h), t).length).toBeGreaterThan(0);
      }
    }
  });

  it('opens the doors toward the plaza', () => {
    for (const id of ['escritorio', 'sala']) {
      const h = HOUSES.find((x) => x.id === id)!;
      const o = outsideDoor(h);
      expect(isBlocked(o.x, o.y)).toBe(false);
      expect(findPath(AVATAR_SPAWN, o).length).toBeGreaterThan(0);
    }
  });

  it('returns no path for out-of-bounds targets and none when already there', () => {
    expect(findPath(AVATAR_SPAWN, { x: -3, y: 4 })).toEqual([]);
    expect(findPath(AVATAR_SPAWN, AVATAR_SPAWN)).toEqual([]);
    expect(nearestFree({ x: PLAZA_CENTER.x, y: PLAZA_CENTER.y })).not.toBeNull();
    expect(MAP_H).toBeGreaterThan(0);
  });

  it('has a map size read from the file', () => {
    expect(MAP_W).toBe(WORLD.width);
    expect(MAP_H).toBe(25);
  });
});

const fresh = (): TiledMap => JSON.parse(worldRaw) as TiledMap;
const objectsOf = (m: TiledMap) => m.layers.find((l) => l.type === 'objectgroup')!.objects!;

describe('world.tmj', () => {
  it('loads and validates', () => {
    expect(validateWorldMap(fresh())).toEqual([]);
    expect(parseWorldMap(fresh()).houses.length).toBe(HOUSES.length);
  });

  it('gives every house and desk its required props, and the meeting room its chairs', () => {
    const objs = objectsOf(fresh());
    const prop = (o: { properties?: { name: string; value: unknown }[] }, n: string) => o.properties?.find((p) => p.name === n)?.value;
    const houses = objs.filter((o) => prop(o, 'kind') === 'house');
    expect(houses.length).toBeGreaterThanOrEqual(5);
    for (const o of houses) for (const k of ['project', 'label', 'door', 'tint', 'icon']) expect(prop(o, k), `house "${o.name}" is missing prop "${k}"`).toBeDefined();
    const desks = objs.filter((o) => o.point && prop(o, 'kind') === undefined && prop(o, 'room') === undefined);
    for (const o of desks) for (const k of ['project', 'seat', 'face']) expect(prop(o, k), `desk "${o.name}" is missing prop "${k}"`).toBeDefined();
    const sala = objs.find((o) => prop(o, 'kind') === 'meeting')!;
    expect(prop(sala, 'id')).toBe('sala');
    expect(HOUSES.find((h) => h.id === 'sala')!.seats.length).toBe(8);
  });

  it('names the object in a failure message', () => {
    const broken = fresh();
    const dfl = objectsOf(broken).find((o) => o.name === 'dfl')!;
    dfl.properties = dfl.properties!.filter((p) => p.name !== 'label');
    const desk = objectsOf(broken).find((o) => o.name === 'itera-desk-0')!;
    desk.properties = desk.properties!.filter((p) => p.name !== 'face');
    const errs = validateWorldMap(broken);
    expect(errs).toContain('house "dfl" is missing prop "label"');
    expect(errs).toContain('desk "itera-desk-0" is missing prop "face"');
    expect(() => parseWorldMap(broken)).toThrow('house "dfl" is missing prop "label"');
  });

  it('reads an optional house department and rejects an invalid one', () => {
    const m = fresh();
    const dfl = objectsOf(m).find((o) => o.name === 'dfl')!;
    dfl.properties = [...dfl.properties!, { name: 'department', type: 'string', value: 'engineering' }];
    expect(parseWorldMap(m).houses.find((h) => h.id === 'dfl')?.department).toBe('engineering');
    dfl.properties = dfl.properties.map((p) => (p.name === 'department' ? { ...p, value: 'nope' } : p));
    expect(validateWorldMap(m)).toContain('house "dfl" has invalid department "nope"');
  });

  it('reports two seats on the same tile', () => {
    const m = fresh();
    const objs = m.layers.filter((l) => l.type === 'objectgroup').flatMap((l) => l.objects!);
    const c1 = objs.find((o) => o.name === 'sala-chair-1')!;
    const c5 = objs.find((o) => o.name === 'sala-chair-5')!;
    c5.x = c1.x;
    c5.y = c1.y;
    expect(validateWorldMap(m)).toContain('chair "sala-chair-5" and chair "sala-chair-1" are on the same tile 33,18');
    const d = objs.find((o) => o.name === 'itera-desk-0')!;
    c1.x = d.x;
    c1.y = d.y;
    expect(validateWorldMap(m).some((e) => e.includes('"itera-desk-0"') && e.includes('"sala-chair-1"') && e.includes('same tile'))).toBe(true);
  });

  it('the real map has no seats sharing a tile', () => {
    expect(validateWorldMap(fresh()).filter((e) => e.includes('same tile'))).toEqual([]);
  });

  it('reports a meeting room without chairs', () => {
    const broken = fresh();
    const m = broken.layers.find((l) => l.type === 'objectgroup')!;
    m.objects = m.objects!.filter((o) => !o.name?.startsWith('sala-chair'));
    expect(validateWorldMap(broken)).toContain('meeting room "sala" has no chairs (points with prop room=sala)');
  });

  const prop = (o: { properties?: { name: string; value: unknown }[] }, n: string) => o.properties?.find((p) => p.name === n);

  it('derives door tiles from the map geometry', () => {
    for (const h of HOUSES) {
      expect(h.doors.length, h.id).toBeGreaterThan(0);
      for (const d of h.doors) {
        expect(d.x >= h.x && d.x < h.x + h.w && d.y >= h.y && d.y < h.y + h.h, h.id).toBe(true);
        expect(isBlocked(d.x, d.y)).toBe(false);
      }
    }
    expect(doorTiles(HOUSES.find((h) => h.id === 'itera')!)).toEqual([{ x: 6, y: 10 }, { x: 7, y: 10 }]);
  });

  it('rejects a house that is too small or has no door opening', () => {
    const small = fresh();
    objectsOf(small).find((o) => o.name === 'deck')!.width = 3 * 16;
    expect(validateWorldMap(small).some((e) => e.startsWith('house "deck" is 3x'))).toBe(true);
    const walled = fresh();
    const dfl = objectsOf(walled).find((o) => o.name === 'dfl')!;
    const w = walled.layers.find((l) => l.name === 'walls')!;
    const x0 = dfl.x / 16;
    const y = (dfl.y + dfl.height) / 16 - 1;
    for (let x = x0 + 1; x < x0 + dfl.width / 16 - 1; x++) w.data![y * walled.width + x] = 1;
    walled.tilesets.push({ firstgid: 1, name: 'x', tilecount: 1, tiles: [{ id: 0, properties: [{ name: 'block', type: 'bool', value: true }] }] });
    expect(validateWorldMap(walled)).toContain('house "dfl" has no walkable door tile on its bottom edge');
  });

  it('rejects a bad tile tint', () => {
    const m = fresh();
    m.tilesets[0]!.tiles = [{ id: 0, properties: [{ name: 'tint', type: 'string', value: 'red' }] }];
    expect(validateWorldMap(m)).toContain(`tileset "${m.tilesets[0]!.name}" tile 0 has invalid tint "red"`);
  });

  it('rejects a repeated project, a non-numeric seat and a second meeting room', () => {
    const m = fresh();
    const objs = objectsOf(m);
    const dfl = objs.find((o) => o.name === 'dfl')!;
    const itera = objs.find((o) => o.name === 'itera')!;
    prop(itera, 'project')!.value = prop(dfl, 'project')!.value;
    expect(validateWorldMap(m)).toContain('house "dfl" repeats project "dfl"');
    const m2 = fresh();
    prop(objectsOf(m2).find((o) => o.name === 'itera-desk-0')!, 'seat')!.value = 'one';
    expect(validateWorldMap(m2)).toContain('desk "itera-desk-0" has non-numeric seat "one"');
    const m3 = fresh();
    const sala = objectsOf(m3).find((o) => prop(o, 'kind')?.value === 'meeting')!;
    objectsOf(m3).push({ ...sala, id: 9999, name: 'sala2', properties: sala.properties!.map((p) => (p.name === 'id' ? { ...p, value: 'sala2' } : p)) });
    expect(validateWorldMap(m3)).toContain('meeting room "sala2" is a second meeting room');
  });

  it('loadWorld reports a broken map instead of throwing', () => {
    const bad = loadWorld(JSON.stringify({ ...fresh(), layers: [] }));
    expect(bad.error).toContain('invalid world map');
    expect(bad.world.houses).toEqual([]);
    expect(loadWorld('{not json').error).toBeTruthy();
    expect(loadWorld(worldRaw).error).toBeNull();
  });
});
