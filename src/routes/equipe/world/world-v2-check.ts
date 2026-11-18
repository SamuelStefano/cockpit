// Validator of the 32px city map (public/world/v2/world.tmj). Self-contained: the v1 parser in
// world-map.ts keeps driving the current game until v2 is wired.

export const V2_TILE_LAYERS = ['ground', 'ground2', 'walls', 'furniture_low', 'furniture_high', 'lights'] as const;
export const V2_OBJECT_LAYERS = ['objects', 'zones'] as const;
// furniture_high (roofs, canopies, the upper half of doorways) and ground2/lights never block.
export const V2_BLOCKING_LAYERS = ['ground', 'walls', 'furniture_low'] as const;
const DOORS = ['bottom', 'top', 'east', 'west'];
const FACES = ['left', 'down', 'up', 'right'];

type PropValue = string | number | boolean;
interface TProp { name: string; value: PropValue }
export interface V2Object { id: number; name?: string; x: number; y: number; width: number; height: number; point?: boolean; properties?: TProp[] }
interface V2Tile { id: number; type?: string; properties?: TProp[] }
export interface V2Tileset { firstgid: number; name: string; tilecount: number; image?: string; tiles?: V2Tile[] }
interface V2Layer { name: string; type: string; data?: number[]; objects?: V2Object[] }
export interface V2Map { width: number; height: number; tilewidth: number; tileheight: number; tilesets: V2Tileset[]; layers: V2Layer[] }
export interface Homes { homes: Record<string, { house: string; seat: number }> }
export interface Pt { x: number; y: number }

export const propsOf = (o: { properties?: TProp[] }): Record<string, PropValue> => Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));

export function objects(m: V2Map, layer = 'objects'): V2Object[] {
  return m.layers.find((l) => l.type === 'objectgroup' && l.name === layer)?.objects ?? [];
}

export const tileOf = (m: V2Map, o: V2Object): Pt => ({ x: Math.floor(o.x / m.tilewidth), y: Math.floor(o.y / m.tileheight) });

export interface TileRect { x: number; y: number; w: number; h: number }
export const rectOf = (m: V2Map, o: V2Object): TileRect => ({
  x: Math.round(o.x / m.tilewidth), y: Math.round(o.y / m.tileheight), w: Math.round(o.width / m.tilewidth), h: Math.round(o.height / m.tileheight),
});
const inside = (r: TileRect, p: Pt): boolean => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

export function blockedTiles(m: V2Map): Set<number> {
  const block = new Set<number>();
  for (const ts of m.tilesets) for (const t of ts.tiles ?? []) if (propsOf(t).block === true) block.add(ts.firstgid + t.id);
  const out = new Set<number>();
  for (const l of m.layers) {
    if (l.type !== 'tilelayer' || !(V2_BLOCKING_LAYERS as readonly string[]).includes(l.name)) continue;
    (l.data ?? []).forEach((g, i) => { if (block.has(g)) out.add(i); });
  }
  return out;
}

export function reachable(m: V2Map, blocked: Set<number>, from: Pt): Set<number> {
  const W = m.width;
  const seen = new Set<number>([from.y * W + from.x]);
  const queue = [from.y * W + from.x];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    const cx = cur % W;
    const cy = Math.floor(cur / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= m.height) continue;
      const k = ny * W + nx;
      if (seen.has(k) || blocked.has(k)) continue;
      seen.add(k);
      queue.push(k);
    }
  }
  return seen;
}

const DOOR_STEP: Record<string, Pt> = { bottom: { x: 0, y: 1 }, top: { x: 0, y: -1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };

// Every message names the offending object, e.g. `house "dfl" is missing prop "label"`.
export function validateWorldV2(m: V2Map, homes: Homes): string[] {
  const errs: string[] = [];
  for (const n of V2_TILE_LAYERS) if (!m.layers.some((l) => l.type === 'tilelayer' && l.name === n)) errs.push(`tile layer "${n}" is missing`);
  for (const n of V2_OBJECT_LAYERS) if (!m.layers.some((l) => l.type === 'objectgroup' && l.name === n)) errs.push(`object layer "${n}" is missing`);

  for (const l of m.layers) {
    if (l.type !== 'tilelayer') continue;
    if ((l.data ?? []).length !== m.width * m.height) errs.push(`tile layer "${l.name}" has ${(l.data ?? []).length} cells, expected ${m.width * m.height}`);
    const bad = new Set<number>();
    for (const g of l.data ?? []) if (g && !m.tilesets.some((ts) => g >= ts.firstgid && g < ts.firstgid + ts.tilecount)) bad.add(g);
    for (const g of bad) errs.push(`tile layer "${l.name}" uses gid ${g} outside every embedded tileset`);
  }
  for (const ts of m.tilesets) if ((ts as { source?: string }).source) errs.push(`tileset "${ts.name}" is external; Phaser needs it embedded`);

  const objs = objects(m);
  const need = (what: string, name: string, p: Record<string, PropValue>, keys: string[]): void => {
    for (const k of keys) if (p[k] === undefined || p[k] === '') errs.push(`${what} "${name}" is missing prop "${k}"`);
  };
  const buildings = objs.filter((o) => !o.point && ['house', 'meeting', 'shop', 'board'].includes(String(propsOf(o).kind)));
  for (const o of buildings) {
    const p = propsOf(o);
    const name = String(p.id ?? o.name ?? `#${o.id}`);
    const kind = String(p.kind);
    need(kind, name, p, kind === 'house' ? ['id', 'label', 'door', 'project', 'tint'] : kind === 'meeting' ? ['id', 'label', 'door', 'tint'] : ['id', 'label']);
    if (p.door !== undefined && !DOORS.includes(String(p.door))) errs.push(`${kind} "${name}" has invalid door "${String(p.door)}"`);
  }
  for (const kind of ['meeting', 'shop', 'board']) if (!buildings.some((o) => propsOf(o).kind === kind)) errs.push(`${kind} is missing (a rectangle with prop kind=${kind})`);

  const roomed = buildings.filter((o) => ['house', 'meeting'].includes(String(propsOf(o).kind)));
  for (let i = 0; i < roomed.length; i++) {
    for (let j = i + 1; j < roomed.length; j++) {
      const a = rectOf(m, roomed[i]!);
      const b = rectOf(m, roomed[j]!);
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) errs.push(`building "${roomed[i]!.name}" overlaps "${roomed[j]!.name}"`);
    }
  }

  const blocked = blockedTiles(m);
  const isBlocked = (p: Pt): boolean => p.x < 0 || p.y < 0 || p.x >= m.width || p.y >= m.height || blocked.has(p.y * m.width + p.x);
  const spawn = objs.find((o) => o.point && propsOf(o).kind === 'plaza-spawn' && propsOf(o).role === 'avatar');
  if (!spawn) errs.push('plaza spawn "avatar" is missing (a point with kind=plaza-spawn, role=avatar)');
  if (!objs.some((o) => o.point && propsOf(o).kind === 'plaza-spawn' && propsOf(o).role === 'center')) errs.push('plaza spawn "center" is missing');
  const reach = spawn ? reachable(m, blocked, tileOf(m, spawn)) : new Set<number>();
  const canReach = (p: Pt): boolean => reach.has(p.y * m.width + p.x);

  for (const o of roomed) {
    const p = propsOf(o);
    const name = String(p.id);
    const r = rectOf(m, o);
    const door: Pt = { x: Number(p.doorX), y: Number(p.doorY) };
    const step = DOOR_STEP[String(p.door)];
    if (!step || !Number.isFinite(door.x) || !Number.isFinite(door.y)) { errs.push(`${String(p.kind)} "${name}" has no door tile (doorX/doorY)`); continue; }
    if (!inside(r, door)) errs.push(`${String(p.kind)} "${name}" has its door tile ${door.x},${door.y} outside its rectangle`);
    const front = { x: door.x + step.x, y: door.y + step.y };
    if (inside(r, front) || isBlocked(front)) errs.push(`${String(p.kind)} "${name}" has no free tile in front of its door (${front.x},${front.y})`);
    if (spawn && !canReach(door)) errs.push(`${String(p.kind)} "${name}" door ${door.x},${door.y} cannot be reached from the plaza`);
  }

  const seatTiles = new Map<string, string>();
  const houseRect = new Map(roomed.map((o) => [String(propsOf(o).id), rectOf(m, o)]));
  const anyRect = new Map(buildings.map((o) => [String(propsOf(o).id), rectOf(m, o)]));
  for (const o of objs.filter((x) => x.point)) {
    const p = propsOf(o);
    const isDesk = p.kind === undefined && p.project !== undefined;
    const isChair = p.kind === undefined && p.room !== undefined;
    if (!isDesk && !isChair) continue;
    const label = `${isDesk ? 'desk' : 'chair'} "${o.name ?? o.id}"`;
    need(isDesk ? 'desk' : 'chair', String(o.name ?? o.id), p, [isDesk ? 'project' : 'room', 'seat', 'face']);
    if (typeof p.face === 'string' && !FACES.includes(p.face)) errs.push(`${label} has invalid face "${p.face}"`);
    const t = tileOf(m, o);
    const key = `${t.x},${t.y}`;
    const other = seatTiles.get(key);
    if (other) errs.push(`${label} and ${other} are on the same tile ${key}`);
    else seatTiles.set(key, label);
    const owner = String(isDesk ? p.project : p.room);
    const r = anyRect.get(owner);
    if (!r) errs.push(`${label} points to unknown ${isDesk ? 'house' : 'room'} "${owner}"`);
    else if (houseRect.has(owner) && !inside(r, t)) errs.push(`${label} lies outside "${owner}"`);
    if (isBlocked(t)) errs.push(`${label} is on a blocked tile ${key}`);
    else if (spawn && !canReach(t)) errs.push(`${label} cannot be reached from the plaza (${key})`);
  }

  const desks = objs.filter((o) => o.point && propsOf(o).kind === undefined && propsOf(o).project !== undefined);
  const pcs = objs.filter((o) => o.point && propsOf(o).kind === 'pc');
  for (const [bot, home] of Object.entries(homes.homes)) {
    const r = houseRect.get(home.house);
    if (!r) { errs.push(`bot "${bot}" lives in house "${home.house}", which is not on the map`); continue; }
    const mine = desks.filter((o) => propsOf(o).bot === bot);
    if (mine.length !== 1) errs.push(`bot "${bot}" has ${mine.length} desks, expected 1`);
    for (const d of mine) {
      if (propsOf(d).project !== home.house || !inside(r, tileOf(m, d))) errs.push(`bot "${bot}" desk is not in its house "${home.house}"`);
      if (propsOf(d).seat !== home.seat) errs.push(`bot "${bot}" desk is seat ${String(propsOf(d).seat)}, team-homes says ${home.seat}`);
    }
    const pc = pcs.filter((o) => propsOf(o).bot === bot);
    if (pc.length !== 1) errs.push(`bot "${bot}" has ${pc.length} PCs, expected 1`);
    for (const c of pc) if (!inside(r, tileOf(m, c))) errs.push(`bot "${bot}" PC is not in its house "${home.house}"`);
  }
  return errs;
}

// Tiles whose class (tileset `type`) is `name`, as points.
export function tilesOfType(m: V2Map, layer: string, name: string): Pt[] {
  const gids = new Set<number>();
  for (const ts of m.tilesets) for (const t of ts.tiles ?? []) if (t.type === name) gids.add(ts.firstgid + t.id);
  const data = m.layers.find((l) => l.type === 'tilelayer' && l.name === layer)?.data ?? [];
  const out: Pt[] = [];
  data.forEach((g, i) => { if (gids.has(g)) out.push({ x: i % m.width, y: Math.floor(i / m.width) }); });
  return out;
}
