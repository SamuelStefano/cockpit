import { describe, it, expect } from 'vitest';
import raw from '../../../../public/world/v2/world.tmj?raw';
import homesRaw from '../../../../scripts/team-homes.json?raw';
import botsRaw from '../../../../public/world/v2/bots.json?raw';
import { type Homes, type V2Map } from './world-v2-check';
import {
  AVATAR_SHEET, FOOT_PAD, SEAT_DROP, animFrames, animKey, botAnim, gaitAnim, boxBlocked, buildLayout, charDepth, clampZoomV2, depthsFor, findPathV2, fitZoomV2,
  frameAt, isTypingTarget, isWalkable, isWorldV2, nearestReachable, pcAnimName, pcState, pickZoom, resolveSeats, seatPoint, sheetFor, standPoint,
  stepZoomV2, tileAnimFrame, tileAnimations, tileAt, type BotsMeta, type Face4, type SeatNpc,
} from './world-v2-layout';

const map = JSON.parse(raw) as V2Map;
const homes = (JSON.parse(homesRaw) as { homes: Homes }).homes;
const meta = JSON.parse(botsRaw) as BotsMeta;
const layout = buildLayout(map);
const npc = (id: string, over: Partial<SeatNpc> = {}): SeatNpc => ({ id, home: 'nowhere', ...over });
const same = (a: { x: number; y: number }, b: { x: number; y: number }): boolean => a.x === b.x && a.y === b.y;

describe('buildLayout', () => {
  it('reads desks, chairs, spawn and plaza from the map', () => {
    expect(layout.desks.length).toBeGreaterThanOrEqual(Object.keys(homes).length);
    expect(layout.chairs.length).toBeGreaterThan(0);
    expect(layout.chairs.filter((c) => c.moderator)).toHaveLength(1);
    expect(isWalkable(map, layout.blocked, layout.spawn)).toBe(true);
    expect(layout.plaza.length).toBeGreaterThan(4);
    for (const p of layout.plaza) {
      expect(isWalkable(map, layout.blocked, p)).toBe(true);
      expect(same(p, layout.spawn)).toBe(false);
    }
  });

  it('falls back to the map middle when the spawn is missing', () => {
    const bare: V2Map = { ...map, layers: map.layers.filter((l) => l.type === 'tilelayer') };
    const l = buildLayout(bare);
    expect(l.spawn).toEqual({ x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) });
    expect(l.desks).toEqual([]);
    expect(l.plaza.length).toBeGreaterThan(0);
  });
});

describe('resolveSeats', () => {
  it('seats every bot of team-homes.json at its own desk', () => {
    const npcs = Object.keys(homes).map((id) => npc(id, { home: 'escritorio' }));
    const seats = resolveSeats(layout, npcs);
    for (const [id, h] of Object.entries(homes)) {
      const s = seats.get(id)!;
      const desk = layout.desks.find((d) => d.bot === id)!;
      expect(s.kind).toBe('desk');
      expect(s.seated).toBe(true);
      expect(same(s.tile, desk.tile)).toBe(true);
      expect(desk.house).toBe(h.house);
      expect(s.face).toBe(desk.face);
    }
    expect(new Set([...seats.values()].map((s) => `${s.tile.x},${s.tile.y}`)).size).toBe(npcs.length);
  });

  it('uses home + homeSeat, then the first free desk of the house, then the plaza', () => {
    const spare = layout.desks.filter((d) => d.house === 'deck' && d.bot === null);
    expect(spare.length).toBeGreaterThan(0);
    const bySeat = resolveSeats(layout, [npc('x1', { home: 'deck', homeSeat: spare[0]!.seat })]).get('x1')!;
    expect(same(bySeat.tile, spare[0]!.tile)).toBe(true);
    const crowd = Array.from({ length: spare.length + 2 }, (_, i) => npc(`g${i}`, { home: 'deck' }));
    const seats = resolveSeats(layout, crowd);
    const kinds = crowd.map((c) => seats.get(c.id)!.kind);
    expect(kinds.filter((k) => k === 'desk')).toHaveLength(spare.length);
    expect(kinds.filter((k) => k === 'plaza')).toHaveLength(2);
    expect(same(seats.get('g0')!.tile, spare[0]!.tile)).toBe(true);
  });

  it('never gives a guest the desk reserved for an absent bot through the free-desk rule', () => {
    const owned = layout.desks.filter((d) => d.house === 'deck' && d.bot !== null).map((d) => `${d.tile.x},${d.tile.y}`);
    const crowd = Array.from({ length: 12 }, (_, i) => npc(`g${i}`, { home: 'deck' }));
    for (const s of resolveSeats(layout, crowd).values()) if (s.kind === 'desk') expect(owned).not.toContain(`${s.tile.x},${s.tile.y}`);
  });

  it('puts unknown bots on distinct standing plaza tiles facing down', () => {
    const seats = resolveSeats(layout, [npc('a'), npc('b'), npc('c')]);
    const tiles = [...seats.values()].map((s) => `${s.tile.x},${s.tile.y}`);
    expect(new Set(tiles).size).toBe(3);
    for (const s of seats.values()) expect(s).toMatchObject({ kind: 'plaza', seated: false, face: 'down' });
  });

  it('sends a bot on break to the plaza even when it owns a desk', () => {
    const id = Object.keys(homes)[0]!;
    expect(resolveSeats(layout, [npc(id, { onBreak: true })]).get(id)!.kind).toBe('plaza');
  });

  it('seats a meeting in the room with the moderator at the head chair', () => {
    const ids = Object.keys(homes).slice(0, 4);
    const seats = resolveSeats(layout, ids.map((id, i) => npc(id, { meeting: true, moderator: i === 2 })));
    const head = layout.chairs.find((c) => c.moderator)!;
    expect(same(seats.get(ids[2]!)!.tile, head.tile)).toBe(true);
    for (const id of ids) expect(seats.get(id)!.kind).toBe('chair');
    expect(new Set(ids.map((id) => `${seats.get(id)!.tile.x},${seats.get(id)!.tile.y}`)).size).toBe(4);
  });

  it('is stable for the same input', () => {
    const npcs = [npc('a'), npc('otto'), npc('b', { home: 'deck' })];
    expect([...resolveSeats(layout, npcs)]).toEqual([...resolveSeats(layout, npcs)]);
  });
});

describe('seat pixels', () => {
  it('centres on the tile and drops seated bots a little', () => {
    const t = { x: 3, y: 5 };
    expect(seatPoint(map, t, false)).toEqual({ x: 3 * map.tilewidth + map.tilewidth / 2, y: 6 * map.tileheight - FOOT_PAD });
    expect(seatPoint(map, t, true).y).toBe(6 * map.tileheight - SEAT_DROP);
    expect(standPoint(map, t)).toEqual(seatPoint(map, t, false));
    expect(tileAt(map, seatPoint(map, t, true).x, seatPoint(map, t, true).y)).toEqual(t);
  });
});

describe('zoom', () => {
  it('only yields 1x, 2x or 3x', () => {
    expect(pickZoom(390, 700, 32)).toBe(1);
    expect(pickZoom(1280, 720, 32)).toBe(2);
    expect(pickZoom(1920, 1080, 32)).toBe(3);
    expect(pickZoom(5000, 4000, 32)).toBe(3);
    expect(pickZoom(0, 0, 32)).toBe(1);
    expect(fitZoomV2(800, 600, 3072, 2048)).toBe(1);
    expect(fitZoomV2(7000, 5000, 3072, 2048)).toBe(2);
    expect(clampZoomV2(2.4)).toBe(2);
    expect(clampZoomV2(Number.NaN)).toBe(1);
  });

  it('steps one level at a time and stays in range', () => {
    expect(stepZoomV2(1, 1)).toBe(2);
    expect(stepZoomV2(3, 1)).toBe(3);
    expect(stepZoomV2(1, -1)).toBe(1);
    expect(stepZoomV2(2, -40)).toBe(1);
  });
});

describe('depth', () => {
  it('draws furniture_high and lights above every character and characters by y', () => {
    const d = depthsFor(map);
    const bottom = charDepth(d, map.height * map.tileheight);
    expect(d.layers.furniture_low!).toBeLessThan(charDepth(d, 0));
    expect(d.layers.furniture_high!).toBeGreaterThan(bottom);
    expect(d.layers.lights!).toBeGreaterThan(d.layers.furniture_high!);
    expect(d.labels).toBeGreaterThan(d.layers.lights!);
    expect(charDepth(d, 200)).toBeGreaterThan(charDepth(d, 100));
    const taller = depthsFor({ ...map, height: map.height * 2 });
    expect(taller.layers.furniture_high!).toBeGreaterThan(charDepth(taller, map.height * 2 * map.tileheight));
  });
});

describe('paths', () => {
  it('walks from the spawn to every bot desk over free, adjacent tiles', () => {
    for (const desk of layout.desks.filter((d) => d.bot !== null)) {
      const path = findPathV2(map, layout.blocked, layout.spawn, desk.tile);
      expect(path.length).toBeGreaterThan(0);
      expect(same(path[path.length - 1]!, desk.tile)).toBe(true);
      let prev = layout.spawn;
      for (const p of path) {
        expect(isWalkable(map, layout.blocked, p)).toBe(true);
        expect(Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y)).toBe(1);
        prev = p;
      }
    }
  });

  it('returns nothing for a blocked, outside or identical target', () => {
    const wall = [...layout.blocked][0]!;
    expect(findPathV2(map, layout.blocked, layout.spawn, { x: wall % map.width, y: Math.floor(wall / map.width) })).toEqual([]);
    expect(findPathV2(map, layout.blocked, layout.spawn, { x: -1, y: 0 })).toEqual([]);
    expect(findPathV2(map, layout.blocked, layout.spawn, layout.spawn)).toEqual([]);
  });

  it('finds a reachable tile next to a blocked one', () => {
    const desk = layout.desks[0]!;
    const above = { x: desk.tile.x, y: desk.tile.y - 1 };
    expect(isWalkable(map, layout.blocked, above)).toBe(false);
    const near = nearestReachable(map, layout.reach, above)!;
    expect(layout.reach.has(near.y * map.width + near.x)).toBe(true);
    expect(nearestReachable(map, layout.reach, { x: -50, y: -50 })).toBeNull();
  });

  it('blocks a foot box that touches a blocked tile or leaves the map', () => {
    const s = standPoint(map, layout.spawn);
    expect(boxBlocked(map, layout.blocked, s.x, s.y, 6, 6)).toBe(false);
    expect(boxBlocked(map, layout.blocked, -4, s.y, 6, 6)).toBe(true);
    const desk = layout.desks[0]!;
    const d = standPoint(map, { x: desk.tile.x, y: desk.tile.y - 1 });
    expect(boxBlocked(map, layout.blocked, d.x, d.y, 6, 6)).toBe(true);
  });
});

describe('animations', () => {
  it('maps mode and seat to an animation that exists in bots.json', () => {
    const desk = { kind: 'desk', seated: true } as const;
    const plaza = { kind: 'plaza', seated: false } as const;
    const chair = { kind: 'chair', seated: true } as const;
    expect(botAnim('working', desk)).toBe('type');
    expect(botAnim('idle', desk)).toBe('sit');
    expect(botAnim('waiting', desk)).toBe('talk');
    expect(botAnim('working', plaza)).toBe('idle');
    expect(botAnim('waiting', plaza)).toBe('talk');
    expect(botAnim('working', chair)).toBe('sit');
    expect(botAnim('idle', chair, true)).toBe('talk');
    for (const a of ['type', 'sit', 'talk', 'idle', 'walk', 'celebrate']) expect(meta.animations[a]).toBeDefined();
  });

  it('keeps every frame range inside the sheet', () => {
    const total = meta.sheet.columns * (meta.sheet.h / meta.frame.h);
    expect(Object.keys(meta.animations).length).toBeGreaterThanOrEqual(8);
    for (const anim of Object.keys(meta.animations)) {
      for (const face of meta.directions as Face4[]) {
        const f = animFrames(meta, anim, face)!;
        expect(f.start % meta.sheet.columns).toBe(0);
        expect(f.end).toBeGreaterThanOrEqual(f.start);
        expect(f.end - f.start).toBeLessThan(meta.sheet.columns);
        expect(f.end).toBeLessThan(total);
        expect(f.fps).toBeGreaterThan(0);
      }
    }
    expect(animFrames(meta, 'fly', 'down')).toBeNull();
    expect(animKey('otto', 'walk', 'left')).toBe('v2:otto:walk:left');
  });

  it('picks the sprite, then the id, then a stable known sheet', () => {
    expect(sheetFor(meta, 'nami', 'otto')).toBe('nami');
    expect(sheetFor(meta, 'cat', 'otto')).toBe('otto');
    expect(sheetFor(meta, '../x', 'otto')).toBe('otto');
    const fallback = sheetFor(meta, undefined, 'stranger');
    expect(Object.keys(meta.bots)).toContain(fallback);
    expect(fallback).not.toBe(AVATAR_SHEET);
    expect(sheetFor(meta, undefined, 'stranger')).toBe(fallback);
    expect(sheetFor(meta, undefined, 'constructor')).not.toBe('constructor');
  });

  it('names PC animations and cycles frames', () => {
    expect(pcState('working')).toBe('on');
    expect(pcState('waiting')).toBe('alert');
    expect(pcState('idle')).toBe('off');
    expect(pcAnimName('front', 'on')).toBe('front_on');
    expect(pcAnimName('back', 'alert')).toBe('back_alert');
    expect(frameAt(['a', 'b'], 2, 0)).toBe('a');
    expect(frameAt(['a', 'b'], 2, 500)).toBe('b');
    expect(frameAt([], 2, 500)).toBeUndefined();
  });

  it('reads tile animations from the embedded tilesets', () => {
    const anims = tileAnimations(map);
    expect(anims.size).toBeGreaterThan(0);
    const [gid, a] = [...anims][0]!;
    expect(a.frames[0]).toBe(gid);
    expect(tileAnimFrame(a, 0)).toBe(a.frames[0]);
    expect(tileAnimFrame(a, a.durations[0]!)).toBe(a.frames[1]);
    expect(tileAnimFrame(a, a.total)).toBe(a.frames[0]);
  });
});

describe('input and flag', () => {
  it('treats form fields as typing targets', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'textarea' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: 'BODY' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('turns v2 on by ?v2=1 or the stored flag, and off by default', () => {
    expect(isWorldV2('', null)).toBe(false);
    expect(isWorldV2('?demo=1', null)).toBe(false);
    expect(isWorldV2('?v2=1', null)).toBe(true);
    expect(isWorldV2('?demo=1&v2=1', null)).toBe(true);
    expect(isWorldV2('', '1')).toBe(true);
    expect(isWorldV2('', '0')).toBe(false);
    expect(isWorldV2('?v2=0', '1')).toBe(false);
  });
});

describe('gaitAnim', () => {
  it('walks when not running', () => {
    expect(gaitAnim(meta, false)).toEqual({ anim: 'walk', scale: 1 });
  });
  it('uses the run sheet rows when bots.json has them, else speeds up walk', () => {
    const withRun = { ...meta, animations: { ...meta.animations, run: meta.animations.walk! } } as BotsMeta;
    const { run: _r, ...rest } = meta.animations;
    expect(gaitAnim(withRun, true)).toEqual({ anim: 'run', scale: 1 });
    expect(gaitAnim({ ...meta, animations: rest } as BotsMeta, true)).toEqual({ anim: 'walk', scale: 1.6 });
  });
});

describe('seats from the bot own home', () => {
  it('seats by the unfiltered v2 home and by name slug on the desk', () => {
    const l = buildLayout(map);
    const desk = l.desks.find((d) => d.bot === 'iris')!;
    const seats = resolveSeats(l, [{ id: 'bmw123', name: 'Íris', home: 'escritorio' }]);
    expect(seats.get('bmw123')?.tile).toEqual(desk.tile);
    const free = l.desks.find((d) => d.bot === null && d.house === 'qa')!;
    const s2 = resolveSeats(l, [{ id: 'zzz', name: 'Zzz', home: 'escritorio', homeV2: 'qa', seatV2: free.seat }]);
    expect(s2.get('zzz')?.tile).toEqual(free.tile);
    expect(s2.get('zzz')?.kind).toBe('desk');
  });
});

describe('ground surface under the feet', () => {
  it('reads tile.surface from the ground layer and gates the dust on it', async () => {
    const { dustAllowed, surfaceOfProps } = await import('./world-run');
    const { groundProps } = await import('./world-v2-layout');
    const ground = map.layers.find((l) => l.name === 'ground')!.data!;
    const surfaces = new Map<string, number>();
    ground.forEach((g, i) => {
      if (!g) return;
      const p = groundProps(map, (i % map.width) * map.tilewidth + 1, Math.floor(i / map.width) * map.tileheight + 1);
      const s = surfaceOfProps(p);
      if (!surfaces.has(s)) surfaces.set(s, i);
    });
    expect(surfaces.has('grass')).toBe(true);
    expect(surfaces.has('unknown')).toBe(false);
    expect(dustAllowed('grass')).toBe(true);
    const loose = ['grass', 'dirt', 'sand'].some((k) => surfaces.has(k));
    const hard = ['paved', 'wood', 'floor', 'water'].some((k) => surfaces.has(k));
    expect(loose && hard).toBe(true);
    const paved = surfaces.get('paved');
    if (paved !== undefined) {
      const p = groundProps(map, (paved % map.width) * map.tilewidth + 1, Math.floor(paved / map.width) * map.tileheight + 1);
      expect(dustAllowed(surfaceOfProps(p))).toBe(false);
    }
  });
  it('is undefined outside the map', async () => {
    const { groundProps } = await import('./world-v2-layout');
    expect(groundProps(map, -5, -5)).toBeUndefined();
  });
});
