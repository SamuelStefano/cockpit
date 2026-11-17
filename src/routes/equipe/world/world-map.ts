// Pure layout of the team world, read from the Tiled map in public/world/world.tmj.
// No Phaser here, so it is unit-testable and stays out of the lazy chunk.
import worldRaw from '../../../../public/world/world.tmj?raw';

export const TILE = 16;

export interface Point { x: number; y: number }
// Frame = row * columns + column. Town and dungeon sheets have 12 columns, indoor and urban 27.
export const tf = (c: number, r: number): number => r * 12 + c;
export const inf = (c: number, r: number): number => r * 27 + c;
export type Sheet = 'town' | 'dungeon' | 'indoor' | 'urban';
export type Face = 'left' | 'down' | 'up' | 'right';
export interface Seat { x: number; y: number; face: Face }
export type BuildingId = string;
export type Door = 'bottom' | 'east' | 'west';

export interface HouseDef {
  id: BuildingId;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tint: number;
  door: Door;
  // Frame in a sheet used as the pixel icon on the house sign.
  icon: { s: Sheet; f: number };
  // Where a bot sits (tiles relative to the house); the order is the order seats are given out.
  seats: Seat[];
}

export interface Tree { x: number; y: number; kind: string }
export interface Rect { x0: number; x1: number; y0: number; y1: number }
export interface Bed { x: number; y: number; w: number; h: number }
export interface Sign { x: number; y: number; label: string }

export interface WorldMap {
  width: number;
  height: number;
  houses: HouseDef[];
  blocked: Set<number>;
  trees: Tree[];
  flowerBeds: Bed[];
  signs: Sign[];
  street: Rect & { tint: number };
  road: Rect;
  plaza: Rect & { tint: number; tint2: number };
  plazaCenter: Point;
  plazaRadius: { rx: number; ry: number };
  avatarSpawn: Point;
}

type PropValue = string | number | boolean;
interface TiledProp { name: string; type?: string; value: PropValue }
interface TiledObject { id: number; name?: string; x: number; y: number; width: number; height: number; point?: boolean; properties?: TiledProp[] }
interface TiledTileset { firstgid: number; name: string; tilecount: number; tiles?: { id: number; properties?: TiledProp[] }[] }
interface TiledLayer { name: string; type: string; width?: number; height?: number; data?: number[]; objects?: TiledObject[] }
export interface TiledMap { width: number; height: number; tilewidth: number; tileheight: number; tilesets: TiledTileset[]; layers: TiledLayer[] }

const SHEETS: readonly Sheet[] = ['town', 'dungeon', 'indoor', 'urban'];
const DOORS: readonly string[] = ['bottom', 'east', 'west'];
const FACES: readonly string[] = ['left', 'down', 'up', 'right'];
const BLOCKING_LAYERS = ['walls', 'furniture', 'decor'];

type Props = Record<string, PropValue>;
const propsOf = (o: { properties?: TiledProp[] }): Props => Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
const nameOf = (o: TiledObject, p: Props, key: string): string => o.name || (typeof p[key] === 'string' ? (p[key] as string) : `#${o.id}`);

// '#AARRGGBB' (Tiled color property) or '#RRGGBB' to 0xRRGGBB.
export function parseColor(v: PropValue | undefined): number | null {
  if (typeof v !== 'string') return null;
  const m = /^#([0-9a-f]{2})?([0-9a-f]{6})$/i.exec(v);
  return m ? parseInt(m[2]!, 16) : null;
}

export function parseIcon(v: PropValue | undefined): { s: Sheet; f: number } | null {
  if (typeof v !== 'string') return null;
  const [s, f] = v.split(':');
  return SHEETS.includes(s as Sheet) && /^\d+$/.test(f ?? '') ? { s: s as Sheet, f: Number(f) } : null;
}

const objectsOf = (m: TiledMap): TiledObject[] => m.layers.filter((l) => l.type === 'objectgroup').flatMap((l) => l.objects ?? []);
const tileX = (o: TiledObject): number => Math.floor(o.x / TILE);
const tileY = (o: TiledObject): number => Math.floor(o.y / TILE);

// Every message names the offending object, e.g. `house "dfl" is missing prop "label"`.
export function validateWorldMap(m: TiledMap): string[] {
  const errs: string[] = [];
  const need = (what: string, name: string, p: Props, keys: string[]): void => {
    for (const k of keys) if (p[k] === undefined || p[k] === '') errs.push(`${what} "${name}" is missing prop "${k}"`);
  };
  const objs = objectsOf(m);
  const houses = new Set<string>();
  let meeting: string | null = null;
  for (const o of objs.filter((x) => !x.point)) {
    const p = propsOf(o);
    if (p.kind !== 'house' && p.kind !== 'meeting') continue;
    const isMeeting = p.kind === 'meeting';
    const what = isMeeting ? 'meeting room' : 'house';
    const name = nameOf(o, p, isMeeting ? 'id' : 'project');
    need(what, name, p, [isMeeting ? 'id' : 'project', 'label', 'door', 'tint', 'icon']);
    if (typeof p.door === 'string' && !DOORS.includes(p.door)) errs.push(`${what} "${name}" has invalid door "${p.door}"`);
    if (p.tint !== undefined && parseColor(p.tint) === null) errs.push(`${what} "${name}" has invalid tint "${String(p.tint)}"`);
    if (p.icon !== undefined && p.icon !== '' && !parseIcon(p.icon)) errs.push(`${what} "${name}" has invalid icon "${String(p.icon)}"`);
    if (isMeeting) meeting = String(p.id ?? name); else if (typeof p.project === 'string') houses.add(p.project);
  }
  if (meeting === null) errs.push('meeting room is missing (a rectangle with prop kind=meeting)');
  const seen = new Set<string>();
  let chairs = 0;
  for (const o of objs.filter((x) => x.point)) {
    const p = propsOf(o);
    if (p.room !== undefined) {
      const name = nameOf(o, p, 'room');
      need('chair', name, p, ['room', 'seat', 'face']);
      if (typeof p.face === 'string' && !FACES.includes(p.face)) errs.push(`chair "${name}" has invalid face "${p.face}"`);
      if (meeting !== null && p.room !== meeting) errs.push(`chair "${name}" belongs to unknown room "${String(p.room)}"`);
      chairs++;
    } else if (p.kind === undefined) {
      const name = nameOf(o, p, 'project');
      need('desk', name, p, ['project', 'seat', 'face']);
      if (typeof p.face === 'string' && !FACES.includes(p.face)) errs.push(`desk "${name}" has invalid face "${p.face}"`);
      if (typeof p.project === 'string' && !houses.has(p.project)) errs.push(`desk "${name}" points to unknown project "${p.project}"`);
      const dup = `${String(p.project)}#${String(p.seat)}`;
      if (p.project !== undefined && p.seat !== undefined && seen.has(dup)) errs.push(`desk "${name}" repeats seat ${String(p.seat)} of "${String(p.project)}"`);
      seen.add(dup);
    } else if (p.kind === 'tree') need('tree', nameOf(o, p, 'variant'), p, ['variant']);
    else if (p.kind === 'sign') need('sign', nameOf(o, p, 'label'), p, ['label']);
  }
  if (meeting !== null && chairs === 0) errs.push(`meeting room "${meeting}" has no chairs (points with prop room=${meeting})`);
  for (const kind of ['street', 'road', 'plaza']) {
    if (!objs.some((o) => !o.point && propsOf(o).kind === kind)) errs.push(`${kind} is missing (a rectangle with prop kind=${kind})`);
  }
  for (const role of ['avatar', 'center']) {
    if (!objs.some((o) => o.point && propsOf(o).kind === 'plaza-spawn' && propsOf(o).role === role)) errs.push(`plaza spawn "${role}" is missing (a point with kind=plaza-spawn, role=${role})`);
  }
  for (const name of ['ground', 'walls', 'furniture', 'decor']) {
    if (!m.layers.some((l) => l.type === 'tilelayer' && l.name === name)) errs.push(`tile layer "${name}" is missing`);
  }
  return errs;
}

export const key = (x: number, y: number, w: number = MAP_W): number => y * w + x;

export function parseWorldMap(m: TiledMap): WorldMap {
  const errs = validateWorldMap(m);
  if (errs.length > 0) throw new Error(`invalid world map: ${errs.join('; ')}`);
  const W = m.width;
  const objs = objectsOf(m);
  const rects = (kind: string) => objs.filter((o) => !o.point && propsOf(o).kind === kind);
  const toRect = (o: TiledObject): Rect => ({ x0: tileX(o), x1: Math.floor((o.x + o.width) / TILE) - 1, y0: tileY(o), y1: Math.floor((o.y + o.height) / TILE) - 1 });

  const houses: HouseDef[] = [];
  const seatsOf = (pick: (p: Props) => boolean) => objs.filter((o) => o.point && pick(propsOf(o)))
    .sort((a, b) => Number(propsOf(a).seat) - Number(propsOf(b).seat));
  for (const o of objs.filter((x) => !x.point)) {
    const p = propsOf(o);
    if (p.kind !== 'house' && p.kind !== 'meeting') continue;
    const id = String(p.kind === 'meeting' ? p.id : p.project);
    const hx = tileX(o);
    const hy = tileY(o);
    const seats = seatsOf((q) => (p.kind === 'meeting' ? q.room === id : q.room === undefined && q.kind === undefined && q.project === id))
      .map((s): Seat => ({ x: tileX(s) - hx, y: tileY(s) - hy, face: propsOf(s).face as Face }));
    houses.push({
      id, label: String(p.label), x: hx, y: hy, w: Math.round(o.width / TILE), h: Math.round(o.height / TILE),
      tint: parseColor(p.tint)!, door: p.door as Door, icon: parseIcon(p.icon)!, seats,
    });
  }

  const blocked = new Set<number>();
  for (let x = 0; x < W; x++) { blocked.add(key(x, 0, W)); blocked.add(key(x, m.height - 1, W)); }
  for (let y = 0; y < m.height; y++) { blocked.add(key(0, y, W)); blocked.add(key(W - 1, y, W)); }
  const blockGids = new Set<number>();
  for (const ts of m.tilesets) for (const t of ts.tiles ?? []) if (propsOf(t).block === true) blockGids.add(ts.firstgid + t.id);
  for (const l of m.layers) {
    if (l.type !== 'tilelayer' || !BLOCKING_LAYERS.includes(l.name)) continue;
    (l.data ?? []).forEach((g, i) => { if (g && blockGids.has(g)) blocked.add(i); });
  }
  const trees = objs.filter((o) => o.point && propsOf(o).kind === 'tree').map((o): Tree => ({ x: tileX(o), y: tileY(o), kind: String(propsOf(o).variant) }));
  for (const t of trees) blocked.add(key(t.x, t.y, W));
  const flowerBeds = rects('flowerbed').map((o): Bed => ({ x: tileX(o), y: tileY(o), w: Math.round(o.width / TILE), h: Math.round(o.height / TILE) }));
  for (const b of flowerBeds) for (let x = 0; x < b.w; x++) for (let y = 0; y < b.h; y++) blocked.add(key(b.x + x, b.y + y, W));

  const street = rects('street')[0]!;
  const plaza = rects('plaza')[0]!;
  const spawn = (role: string) => objs.find((o) => o.point && propsOf(o).kind === 'plaza-spawn' && propsOf(o).role === role)!;
  const center = spawn('center');
  const cp = propsOf(center);
  return {
    width: W, height: m.height, houses, blocked, trees, flowerBeds,
    signs: objs.filter((o) => o.point && propsOf(o).kind === 'sign').map((o) => ({ x: tileX(o), y: tileY(o), label: String(propsOf(o).label) })),
    street: { ...toRect(street), tint: parseColor(propsOf(street).tint) ?? 0xffffff },
    road: toRect(rects('road')[0]!),
    plaza: { ...toRect(plaza), tint: parseColor(propsOf(plaza).tint) ?? 0xffffff, tint2: parseColor(propsOf(plaza).tint2) ?? parseColor(propsOf(plaza).tint) ?? 0xffffff },
    plazaCenter: { x: tileX(center), y: tileY(center) },
    plazaRadius: { rx: Number(cp.rx ?? 6), ry: Number(cp.ry ?? 3) },
    avatarSpawn: { x: tileX(spawn('avatar')), y: tileY(spawn('avatar')) },
  };
}

export const WORLD: WorldMap = parseWorldMap(JSON.parse(worldRaw) as TiledMap);

export const MAP_W = WORLD.width;
export const MAP_H = WORLD.height;
export const HOUSES: readonly HouseDef[] = WORLD.houses;
export const TREES: readonly Tree[] = WORLD.trees;
export const FLOWER_BEDS: readonly Bed[] = WORLD.flowerBeds;
export const STREET = WORLD.street;
export const ROAD = WORLD.road;
export const PLAZA = WORLD.plaza;
export const PLAZA_CENTER: Point = WORLD.plazaCenter;
export const PLAZA_RADIUS = WORLD.plazaRadius;
export const AVATAR_SPAWN: Point = WORLD.avatarSpawn;

export function doorTiles(h: HouseDef): Point[] {
  if (h.door === 'east') return [{ x: h.x + h.w - 1, y: h.y + 3 }, { x: h.x + h.w - 1, y: h.y + 4 }];
  if (h.door === 'west') return [{ x: h.x, y: h.y + 3 }, { x: h.x, y: h.y + 4 }];
  return [{ x: h.x + 4, y: h.y + h.h - 1 }, { x: h.x + 5, y: h.y + h.h - 1 }];
}

// The tile just outside / inside the first door tile.
export function outsideDoor(h: HouseDef): Point {
  const d = doorTiles(h)[0]!;
  return h.door === 'east' ? { x: d.x + 1, y: d.y } : h.door === 'west' ? { x: d.x - 1, y: d.y } : { x: d.x, y: d.y + 1 };
}
export function insideDoor(h: HouseDef): Point {
  const d = doorTiles(h)[0]!;
  return h.door === 'east' ? { x: d.x - 1, y: d.y } : h.door === 'west' ? { x: d.x + 1, y: d.y } : { x: d.x, y: d.y - 2 };
}

export const seatTile = (h: HouseDef, s: Seat): Point => ({ x: h.x + s.x, y: h.y + s.y });
export const buildingById = (id: BuildingId): HouseDef => HOUSES.find((h) => h.id === id)!;

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

export function isBlocked(x: number, y: number): boolean {
  return !inBounds(x, y) || WORLD.blocked.has(key(x, y));
}

export const toTile = (px: number): number => Math.floor(px / TILE);
export const tileCenter = (t: number): number => t * TILE + TILE / 2;

// Evenly spaced NPC slots on an ellipse around the fountain; a blocked slot is
// nudged to the nearest free tile.
export function plazaSlots(n: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    const p = { x: Math.round(PLAZA_CENTER.x + Math.cos(a) * PLAZA_RADIUS.rx), y: Math.round(PLAZA_CENTER.y + Math.sin(a) * PLAZA_RADIUS.ry) };
    out.push(isBlocked(p.x, p.y) ? (nearestFree(p) ?? p) : p);
  }
  return out;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Breadth-first search on the tile grid, 8 directions, no corner cutting. A blocked
// goal resolves to the reachable tile closest to it, so tapping a wall or a desk
// still walks the avatar next to it (never into a room it cannot enter).
export function findPath(from: Point, to: Point): Point[] {
  if (!inBounds(from.x, from.y) || !inBounds(to.x, to.y)) return [];
  const prev = new Map<number, number>();
  const start = key(from.x, from.y);
  prev.set(start, -1);
  const queue: number[] = [start];
  const goalKey = key(to.x, to.y);
  const blockedGoal = isBlocked(to.x, to.y);
  let best = start;
  let bestD = Math.hypot(from.x - to.x, from.y - to.y);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    if (cur === goalKey) { best = cur; break; }
    const cx = cur % MAP_W;
    const cy = Math.floor(cur / MAP_W);
    if (blockedGoal) {
      const d = Math.hypot(cx - to.x, cy - to.y);
      if (d < bestD) { bestD = d; best = cur; }
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBlocked(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (isBlocked(cx + dx, cy) || isBlocked(cx, cy + dy))) continue;
      const nk = key(nx, ny);
      if (prev.has(nk)) continue;
      prev.set(nk, cur);
      queue.push(nk);
    }
  }
  if (best === start) return [];
  const path: Point[] = [];
  for (let k = best; k !== start && k !== -1; k = prev.get(k)!) path.push({ x: k % MAP_W, y: Math.floor(k / MAP_W) });
  return path.reverse();
}

export function nearestFree(p: Point, radius = 4): Point | null {
  for (let r = 0; r <= radius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!isBlocked(p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
      }
    }
  }
  return null;
}
