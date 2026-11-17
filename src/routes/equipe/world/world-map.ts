// Pure layout of the team world: tile coordinates, furniture, blocked tiles and
// path-finding. No Phaser here, so it is unit-testable and stays out of the lazy chunk.

export const TILE = 16;
export const MAP_W = 40;
export const MAP_H = 25;

export interface Point { x: number; y: number }

export type Sheet = 'town' | 'dungeon' | 'indoor' | 'urban';

// Frame = row * columns + column. Town and dungeon sheets have 12 columns, indoor 27.
export const tf = (c: number, r: number): number => r * 12 + c;
export const inf = (c: number, r: number): number => r * 27 + c;
export const urf = inf;

export interface Item {
  s: Sheet;
  f: number;
  x: number;
  y: number;
  // Blocks walking (and gets a drop shadow).
  block?: boolean;
  // 'floor' sits under the furniture (rugs); 'top' sits on a desk (monitors).
  layer?: 'floor' | 'top' | 'wall';
}

const it = (s: Sheet, f: number, x: number, y: number, block = false, layer?: Item['layer']): Item => ({ s, f, x, y, block, layer });
const ind = (f: number, x: number, y: number, block = false, layer?: Item['layer']) => it('indoor', f, x, y, block, layer);
const dun = (f: number, x: number, y: number, block = false, layer?: Item['layer']) => it('dungeon', f, x, y, block, layer);

const FRAMES = {
  counter: inf(0, 12), counter2: inf(4, 12), stove: [inf(14, 14), inf(15, 14), inf(14, 15), inf(15, 15)],
  deskTop: [inf(4, 2), inf(5, 2), inf(6, 2)], deskFront: [inf(4, 3), inf(5, 3), inf(6, 3)],
  chair: inf(0, 2), plant: inf(16, 0), plant2: inf(17, 0), lampTop: inf(20, 4), lampBase: inf(20, 5),
  frameOrange: inf(19, 13), frameGreen: inf(19, 12), frameTeal: inf(19, 14), clock: inf(22, 11),
  rugOrange: [inf(16, 8), inf(17, 8), inf(18, 8), inf(16, 9), inf(17, 9), inf(18, 9)],
  rugGreen: [inf(16, 10), inf(17, 10), inf(18, 10), inf(16, 11), inf(17, 11), inf(18, 11)],
  roundTable: [inf(3, 0), inf(4, 0), inf(3, 1), inf(4, 1)], sofa: [inf(10, 6), inf(11, 6)],
  console: [inf(23, 8), inf(24, 8)], bench: [inf(10, 3), inf(11, 3)],
  monitor: tf(7, 4), shelfA: tf(3, 5), shelfB: tf(3, 6), sign: tf(11, 6),
};

function rug(frames: number[], x: number, y: number): Item[] {
  return frames.map((f, i) => ind(f, x + (i % 3), y + Math.floor(i / 3), false, 'floor'));
}
function block2x2(s: Sheet, frames: number[], x: number, y: number, block = true): Item[] {
  return frames.map((f, i) => it(s, f, x + (i % 2), y + Math.floor(i / 2), block));
}
const lamp = (x: number, y: number): Item[] => [ind(FRAMES.lampTop, x, y, true), ind(FRAMES.lampBase, x, y + 1, true)];
const desk = (x: number, y: number, w: number, monitors = true): Item[] => {
  const out: Item[] = [];
  for (let i = 0; i < w; i++) {
    out.push(ind(FRAMES.deskTop[Math.min(i, 2)]!, x + i, y, true), ind(FRAMES.deskFront[Math.min(i, 2)]!, x + i, y + 1, true));
    if (monitors) out.push(dun(FRAMES.monitor, x + i, y, false, 'top'));
  }
  return out;
};
const shelf = (x: number, y: number): Item[] => [dun(FRAMES.shelfA, x, y, true), dun(FRAMES.shelfB, x, y + 1, true)];
// Back wall decor on the first interior row, plus the kitchen corner (top right).
const kitchen = (): Item[] => [
  ind(FRAMES.counter, 6, 1, true), ...block2x2('indoor', FRAMES.stove, 7, 1),
];

export type Face = 'left' | 'down' | 'up' | 'right';
export interface Seat { x: number; y: number; face: Face }

export type BuildingId = 'itera' | 'dfl' | 'corte-radar' | 'escritorio' | 'sala';

export interface HouseDef {
  id: BuildingId;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tint: number;
  door: 'bottom' | 'east' | 'west';
  // Frame in the town/dungeon sheet used as the pixel icon on the house sign.
  icon: { s: Sheet; f: number };
  items: Item[];
  // Where a bot sits (relative tiles); the order is the order seats are given out.
  seats: Seat[];
}

const HOUSE_Y = 2;
const HOUSE_W = 10;
const HOUSE_H = 9;
const plant = (x: number, y: number, two = false): Item => ind(two ? FRAMES.plant2 : FRAMES.plant, x, y, true);
const chair = (x: number, y: number): Item => ind(FRAMES.chair, x, y);

export const HOUSES: readonly HouseDef[] = [
  {
    id: 'itera', label: 'Itera', x: 2, y: HOUSE_Y, w: HOUSE_W, h: HOUSE_H, tint: 0xd2f0de, door: 'bottom', icon: { s: 'town', f: tf(5, 1) },
    items: [
      ...rug(FRAMES.rugGreen, 2, 4), ...rug(FRAMES.rugOrange, 5, 2),
      ...shelf(1, 1), ...shelf(2, 1), ...shelf(3, 1), ...shelf(1, 4),
      ind(FRAMES.frameOrange, 4, 1, false, 'wall'), ind(FRAMES.clock, 5, 1, false, 'wall'),
      ...kitchen(),
      ...desk(3, 4, 2, false), ...desk(6, 4, 2, false),
      chair(3, 6), chair(4, 6), chair(6, 6), chair(7, 6),
      ...lamp(8, 3), plant(8, 7), plant(1, 7, true), plant(1, 3, true), plant(8, 5),
    ],
    seats: [{ x: 3, y: 6, face: 'up' }, { x: 7, y: 6, face: 'up' }, { x: 4, y: 6, face: 'up' }, { x: 6, y: 6, face: 'up' }],
  },
  {
    id: 'dfl', label: 'DFL', x: 15, y: HOUSE_Y, w: HOUSE_W, h: HOUSE_H, tint: 0xdcdcf7, door: 'bottom', icon: { s: 'dungeon', f: tf(9, 9) },
    items: [
      ...rug(FRAMES.rugOrange, 5, 6), ...rug(FRAMES.rugGreen, 1, 6),
      ind(FRAMES.frameTeal, 4, 1, false, 'wall'), ind(FRAMES.clock, 5, 1, false, 'wall'), ind(FRAMES.frameGreen, 2, 1, false, 'wall'),
      ...kitchen(),
      ...desk(1, 2, 2), ...desk(1, 4, 2),
      chair(3, 2), chair(3, 4),
      ...block2x2('indoor', FRAMES.roundTable, 6, 6),
      chair(5, 6), chair(8, 6), chair(6, 5),
      ...lamp(3, 6), plant(8, 7), plant(1, 7, true), plant(8, 3, true), plant(5, 3),
    ],
    seats: [{ x: 3, y: 2, face: 'left' }, { x: 3, y: 4, face: 'left' }, { x: 5, y: 6, face: 'right' }, { x: 8, y: 6, face: 'left' }],
  },
  {
    id: 'corte-radar', label: 'Corte Radar', x: 28, y: HOUSE_Y, w: HOUSE_W, h: HOUSE_H, tint: 0xf5d9d2, door: 'bottom', icon: { s: 'town', f: tf(11, 7) },
    items: [
      ...rug(FRAMES.rugOrange, 5, 5), ...rug(FRAMES.rugGreen, 1, 6),
      dun(FRAMES.monitor, 1, 1, false, 'wall'), dun(FRAMES.monitor, 2, 1, false, 'wall'), dun(FRAMES.monitor, 3, 1, false, 'wall'),
      ind(FRAMES.frameOrange, 4, 1, false, 'wall'), ind(FRAMES.clock, 5, 1, false, 'wall'),
      ...kitchen(),
      ...desk(1, 3, 3), ind(FRAMES.console[0]!, 4, 3, true), ind(FRAMES.console[1]!, 5, 3, true),
      chair(1, 5), chair(2, 5), chair(3, 5), chair(4, 5),
      ind(FRAMES.sofa[0]!, 6, 6, true), ind(FRAMES.sofa[1]!, 7, 6, true),
      ...lamp(8, 4), plant(8, 7), plant(1, 7, true), plant(8, 3, true),
    ],
    seats: [{ x: 1, y: 5, face: 'up' }, { x: 2, y: 5, face: 'up' }, { x: 3, y: 5, face: 'up' }, { x: 4, y: 5, face: 'up' }],
  },
  {
    id: 'escritorio', label: 'Escritório', x: 3, y: 16, w: 9, h: 8, tint: 0xf1e6c8, door: 'east', icon: { s: 'indoor', f: FRAMES.plant },
    items: [
      ...rug(FRAMES.rugGreen, 2, 5), ...rug(FRAMES.rugOrange, 4, 1),
      ...shelf(1, 1), ind(FRAMES.frameGreen, 2, 1, false, 'wall'), ind(FRAMES.clock, 3, 1, false, 'wall'), ind(FRAMES.frameOrange, 4, 1, false, 'wall'),
      ind(FRAMES.counter, 5, 1, true), ...block2x2('indoor', FRAMES.stove, 6, 1),
      ...desk(1, 3, 2), ...desk(4, 3, 2),
      chair(1, 5), chair(2, 5), chair(4, 5), chair(5, 5),
      ...lamp(7, 5), plant(1, 6, true),
    ],
    seats: [{ x: 1, y: 5, face: 'up' }, { x: 4, y: 5, face: 'up' }, { x: 2, y: 5, face: 'up' }, { x: 5, y: 5, face: 'up' }],
  },
  {
    id: 'sala', label: 'Sala de Reunião', x: 28, y: 16, w: 9, h: 8, tint: 0xe6dff5, door: 'west', icon: { s: 'indoor', f: FRAMES.roundTable[0]! },
    items: [
      ...rug(FRAMES.rugOrange, 1, 5), ...rug(FRAMES.rugOrange, 4, 5), ...rug(FRAMES.rugGreen, 3, 3),
      ind(FRAMES.frameOrange, 2, 1, false, 'wall'),
      dun(FRAMES.monitor, 3, 1, false, 'wall'), dun(FRAMES.monitor, 4, 1, false, 'wall'), dun(FRAMES.monitor, 5, 1, false, 'wall'),
      ind(FRAMES.counter, 6, 1, true), ind(FRAMES.counter2, 7, 1, true),
      ...desk(2, 3, 5, false),
      ...[2, 3, 4, 5, 6].flatMap((x) => [chair(x, 2), chair(x, 5)]),
      ...lamp(7, 3), plant(1, 1, true), plant(1, 6), plant(7, 6, true),
    ],
    seats: [
      { x: 3, y: 2, face: 'down' }, { x: 5, y: 2, face: 'down' }, { x: 3, y: 5, face: 'up' }, { x: 5, y: 5, face: 'up' },
      { x: 2, y: 2, face: 'down' }, { x: 6, y: 2, face: 'down' }, { x: 2, y: 5, face: 'up' }, { x: 6, y: 5, face: 'up' },
      { x: 4, y: 2, face: 'down' }, { x: 4, y: 5, face: 'up' },
    ],
  },
];

export const STREET = { x0: 1, x1: 38, y0: 12, y1: 15 } as const;
export const ROAD = { y0: 13, y1: 14 } as const;
export const PLAZA = { x0: 13, x1: 26, y0: 16, y1: 23 } as const;
export const PLAZA_CENTER: Point = { x: 20, y: 20 };
export const STREET_SIGN: Point = { x: 1, y: 12 };
export const AVATAR_SPAWN: Point = { x: 20, y: 22 };

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
  return h.door === 'east' ? { x: d.x - 2, y: d.y } : h.door === 'west' ? { x: d.x + 2, y: d.y } : { x: d.x, y: d.y - 2 };
}

export const seatTile = (h: HouseDef, s: Seat): Point => ({ x: h.x + s.x, y: h.y + s.y });
export const buildingById = (id: BuildingId): HouseDef => HOUSES.find((h) => h.id === id)!;

export interface Tree { x: number; y: number; kind: 'tall' | 'autumn' | 'bush' }
export const TREES: readonly Tree[] = [
  { x: 12, y: 5, kind: 'tall' }, { x: 13, y: 8, kind: 'autumn' }, { x: 14, y: 5, kind: 'tall' },
  { x: 25, y: 5, kind: 'tall' }, { x: 26, y: 8, kind: 'tall' }, { x: 27, y: 5, kind: 'autumn' },
  { x: 12, y: 10, kind: 'bush' }, { x: 13, y: 10, kind: 'bush' }, { x: 14, y: 10, kind: 'bush' },
  { x: 25, y: 10, kind: 'bush' }, { x: 26, y: 10, kind: 'bush' }, { x: 27, y: 10, kind: 'bush' },
  { x: 1, y: 6, kind: 'tall' }, { x: 38, y: 6, kind: 'tall' }, { x: 1, y: 9, kind: 'autumn' }, { x: 38, y: 9, kind: 'tall' },
  { x: 1, y: 22, kind: 'tall' }, { x: 38, y: 22, kind: 'autumn' }, { x: 12, y: 22, kind: 'bush' }, { x: 27, y: 22, kind: 'bush' },
  { x: 37, y: 18, kind: 'bush' }, { x: 2, y: 18, kind: 'bush' },
];

// Plaza and street furniture (absolute tiles).
export const FLOWER_BEDS: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 15, y: 16, w: 2, h: 1 }, { x: 23, y: 16, w: 2, h: 1 }, { x: 37, y: 20, w: 2, h: 2 }, { x: 1, y: 19, w: 2, h: 2 },
];
export const PLAZA_ITEMS: Item[] = [
  ...[[11, 6], [12, 6], [11, 7], [12, 7]].map(([c, r], i) => it('urban', urf(c!, r!), 19 + (i % 2), 19 + Math.floor(i / 2), true)),
  ind(FRAMES.bench[0]!, 14, 23, true), ind(FRAMES.bench[1]!, 15, 23, true), ind(FRAMES.bench[0]!, 24, 23, true), ind(FRAMES.bench[1]!, 25, 23, true),
  ...lamp(13, 17), ...lamp(26, 17), ...lamp(13, 21), ...lamp(26, 21),
  ...lamp(13, 11), ...lamp(26, 11),
  it('town', FRAMES.sign, STREET_SIGN.x, STREET_SIGN.y, true),
];

export const key = (x: number, y: number): number => y * MAP_W + x;

function buildBlocked(): Set<number> {
  const b = new Set<number>();
  for (let x = 0; x < MAP_W; x++) { b.add(key(x, 0)); b.add(key(x, MAP_H - 1)); }
  for (let y = 0; y < MAP_H; y++) { b.add(key(0, y)); b.add(key(MAP_W - 1, y)); }
  for (const h of HOUSES) {
    const doors = new Set(doorTiles(h).map((d) => key(d.x, d.y)));
    for (let dx = 0; dx < h.w; dx++) {
      for (let dy = 0; dy < h.h; dy++) {
        const edge = dx === 0 || dy === 0 || dx === h.w - 1 || dy === h.h - 1;
        const k = key(h.x + dx, h.y + dy);
        if (edge && !doors.has(k)) b.add(k);
      }
    }
    for (const f of h.items) if (f.block) b.add(key(h.x + f.x, h.y + f.y));
  }
  for (const f of PLAZA_ITEMS) if (f.block) b.add(key(f.x, f.y));
  for (const t of TREES) b.add(key(t.x, t.y));
  for (const bed of FLOWER_BEDS) for (let x = 0; x < bed.w; x++) for (let y = 0; y < bed.h; y++) b.add(key(bed.x + x, bed.y + y));
  return b;
}

const BLOCKED = buildBlocked();

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

export function isBlocked(x: number, y: number): boolean {
  return !inBounds(x, y) || BLOCKED.has(key(x, y));
}

export const toTile = (px: number): number => Math.floor(px / TILE);
export const tileCenter = (t: number): number => t * TILE + TILE / 2;

// Evenly spaced NPC slots on an ellipse around the fountain; a blocked slot is
// nudged to the nearest free tile.
export function plazaSlots(n: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    const p = { x: Math.round(PLAZA_CENTER.x + Math.cos(a) * 6), y: Math.round(PLAZA_CENTER.y + Math.sin(a) * 3) };
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
