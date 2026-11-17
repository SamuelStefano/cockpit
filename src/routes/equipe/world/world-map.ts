// Pure layout of the team world: tile coordinates, blocked tiles and path-finding.
// No Phaser here, so it is unit-testable and stays out of the lazy chunk.

export const TILE = 16;
export const MAP_W = 48;
export const MAP_H = 34;

export interface Point { x: number; y: number }

export interface HouseDef {
  id: 'itera' | 'dfl' | 'corte-radar';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  // Tint multiplied over the interior floor so each house reads differently.
  tint: number;
  // Frame in the town sheet used as the pixel icon on the house sign.
  icon: number;
}

const HOUSE_Y = 3;
const HOUSE_W = 10;
const HOUSE_H = 9;

export const HOUSES: readonly HouseDef[] = [
  { id: 'itera', label: 'Itera', x: 3, y: HOUSE_Y, w: HOUSE_W, h: HOUSE_H, tint: 0xd2f0de, icon: 17 },
  { id: 'dfl', label: 'DFL', x: 19, y: HOUSE_Y, w: HOUSE_W, h: HOUSE_H, tint: 0xdcdcf7, icon: 117 },
  { id: 'corte-radar', label: 'Corte Radar', x: 35, y: HOUSE_Y, w: HOUSE_W, h: HOUSE_H, tint: 0xf5d9d2, icon: 95 },
];

export const STREET = { x0: 1, x1: 46, y0: 14, y1: 16 } as const;
export const PLAZA = { x0: 15, x1: 32, y0: 19, y1: 31 } as const;
export const PLAZA_CENTER: Point = { x: 24, y: 25 };
export const CONNECTOR = { x0: 23, x1: 24, y0: 17, y1: 18 } as const;
export const STREET_SIGN: Point = { x: 2, y: 13 };
export const AVATAR_SPAWN: Point = { x: 24, y: 27 };

export const doorTiles = (h: HouseDef): Point[] => [{ x: h.x + 4, y: h.y + h.h - 1 }, { x: h.x + 5, y: h.y + h.h - 1 }];

// Furniture footprint relative to the house origin (interior is x 1..8, y 1..7).
export const FURNITURE_BLOCK: readonly Point[] = [
  { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
  { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 7, y: 2 }, { x: 8, y: 2 },
  { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 8, y: 7 },
];

export const key = (x: number, y: number): number => y * MAP_W + x;

// Trees along the north edge and between the houses.
export const TREES: readonly Point[] = [
  ...[0, 2, 14, 16, 30, 32, 44, 46].map((x): Point => ({ x, y: 1 })),
  ...[14, 15, 16, 17, 30, 31, 32, 33].map((x): Point => ({ x, y: 6 })),
  ...[2, 3, 44, 45].flatMap((x): Point[] => [21, 25, 29].map((y) => ({ x, y }))),
  ...[2, 4, 6, 8, 10, 12, 36, 38, 40, 42, 44].map((x): Point => ({ x, y: 32 })),
];

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
    for (const f of FURNITURE_BLOCK) b.add(key(h.x + f.x, h.y + f.y));
  }
  b.add(key(STREET_SIGN.x, STREET_SIGN.y));
  for (const t of TREES) b.add(key(t.x, t.y));
  // Monument in the middle of the plaza.
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) b.add(key(PLAZA_CENTER.x + dx, PLAZA_CENTER.y + dy));
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

// Evenly spaced NPC slots on an ellipse around the plaza monument. Slots never
// land on a blocked tile: they are nudged outwards in that case.
export function plazaSlots(n: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    out.push({
      x: Math.round(PLAZA_CENTER.x + Math.cos(a) * 6.5),
      y: Math.round(PLAZA_CENTER.y + Math.sin(a) * 4.5),
    });
  }
  return out;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Breadth-first search on the tile grid, 8 directions, no corner cutting. A blocked
// goal resolves to the nearest free tile so tapping a wall still moves the avatar.
export function findPath(from: Point, to: Point): Point[] {
  if (!inBounds(from.x, from.y) || !inBounds(to.x, to.y)) return [];
  const goal = isBlocked(to.x, to.y) ? nearestFree(to) : to;
  if (!goal) return [];
  if (goal.x === from.x && goal.y === from.y) return [];
  const prev = new Map<number, number>();
  const start = key(from.x, from.y);
  prev.set(start, -1);
  const queue: number[] = [start];
  const goalKey = key(goal.x, goal.y);
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    if (cur === goalKey) break;
    const cx = cur % MAP_W;
    const cy = Math.floor(cur / MAP_W);
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
  if (!prev.has(goalKey)) return [];
  const path: Point[] = [];
  for (let k = goalKey; k !== start && k !== -1; k = prev.get(k)!) path.push({ x: k % MAP_W, y: Math.floor(k / MAP_W) });
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
