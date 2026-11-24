import { HOUSES, PLAZA, isBlocked, outsideDoor, type HouseDef, type Point, type Rect } from './world-map';

export const WANDER_MIN_MS = 6000;
export const WANDER_MAX_MS = 14000;
const MIN_HOP = 2;
const MAX_HOP = 9;

export const tileKey = (p: Point): string => `${p.x},${p.y}`;

export function hashId(id: string, salt = 0): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h;
}

export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function wanderDelay(id: string, n: number): number {
  return Math.round(WANDER_MIN_MS + seeded(hashId(id, n * 7919 + 1))() * (WANDER_MAX_MS - WANDER_MIN_MS));
}

// Plaza tiles a bot may stroll to: free, and never within one tile of a door's outside tile.
export function wanderTiles(plaza: Rect = PLAZA, houses: readonly HouseDef[] = HOUSES, blocked: (x: number, y: number) => boolean = isBlocked): Point[] {
  const keep = new Set<string>();
  for (const h of houses) {
    for (const d of h.doors) {
      const o = outsideDoor({ ...h, doors: [d] });
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) keep.add(tileKey({ x: o.x + dx, y: o.y + dy }));
    }
  }
  const out: Point[] = [];
  for (let y = plaza.y0; y <= plaza.y1; y++) {
    for (let x = plaza.x0; x <= plaza.x1; x++) if (!blocked(x, y) && !keep.has(`${x},${y}`)) out.push({ x, y });
  }
  return connectedToLargest(out, blocked);
}

// Keeps only the biggest group of tiles that can walk to each other, so no bot is sent into a sealed pocket.
function connectedToLargest(tiles: Point[], blocked: (x: number, y: number) => boolean): Point[] {
  const left = new Map(tiles.map((t) => [tileKey(t), t]));
  let best: Point[] = [];
  while (left.size > 0) {
    const [k0, t0] = left.entries().next().value!;
    left.delete(k0);
    const group = [t0];
    for (let i = 0; i < group.length; i++) {
      const c = group[i]!;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (dx !== 0 && dy !== 0 && (blocked(c.x + dx, c.y) || blocked(c.x, c.y + dy))) continue;
          const n = left.get(`${c.x + dx},${c.y + dy}`);
          if (n) { left.delete(tileKey(n)); group.push(n); }
        }
      }
    }
    if (group.length > best.length) best = group;
  }
  return best;
}

export function pickWanderTile(id: string, n: number, from: Point, candidates: readonly Point[], occupied: ReadonlySet<string>): Point | null {
  const near = candidates.filter((p) => {
    const d = Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y));
    return d >= MIN_HOP && d <= MAX_HOP && !occupied.has(tileKey(p));
  });
  if (near.length === 0) return null;
  return near[Math.floor(seeded(hashId(id, n * 104729 + 3))() * near.length)]!;
}
