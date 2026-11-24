import { blockedTiles, botId, objects, propsOf, reachable, tileOf, type Pt, type V2Map } from './world-v2-check';

export type Face4 = 'left' | 'down' | 'up' | 'right';
export type BotMode = 'working' | 'idle' | 'waiting';
export type BotAnim = 'idle' | 'walk' | 'sit' | 'type' | 'talk' | 'celebrate' | 'carry' | 'sleep' | 'run';
export type SeatKind = 'desk' | 'chair' | 'plaza';

export interface SeatNpc { id: string; name?: string; home: string; homeSeat?: number; homeV2?: string; seatV2?: number; meeting?: boolean; moderator?: boolean; onBreak?: boolean }
export interface Seat { kind: SeatKind; tile: Pt; x: number; y: number; face: Face4; seated: boolean }
export interface DeskSpot { tile: Pt; face: Face4; house: string; seat: number; bot: string | null }
export interface ChairSpot { tile: Pt; face: Face4; seat: number; moderator: boolean }

export interface V2Layout {
  map: V2Map;
  blocked: Set<number>;
  reach: Set<number>;
  desks: DeskSpot[];
  chairs: ChairSpot[];
  plaza: Pt[];
  spawn: Pt;
  center: Pt;
}

export interface AnimDef { rows: Record<string, number>; frames: number; fps: number }
export interface BotsMeta {
  frame: { w: number; h: number; origin: [number, number] };
  sheet: { w: number; h: number; columns: number };
  directions: string[];
  animations: Record<string, AnimDef>;
  bots: Record<string, { sheet: string; default_shirt?: string }>;
}

export const MEETING_ROOM = 'sala';
export const SEAT_DROP = 6;
export const FOOT_PAD = 2;
export const ZOOM_LEVELS = [1, 2, 3] as const;
export const MIN_ZOOM_V2 = ZOOM_LEVELS[0];
export const MAX_ZOOM_V2 = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!;
export const VIEW_TILES = { x: 14, y: 9 } as const;

const FACES: readonly Face4[] = ['left', 'down', 'up', 'right'];
const faceOf = (v: unknown): Face4 => (FACES.includes(v as Face4) ? (v as Face4) : 'down');
const key = (m: V2Map, p: Pt): number => p.y * m.width + p.x;
const inMap = (m: V2Map, p: Pt): boolean => p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height;

export const isWalkable = (m: V2Map, blocked: Set<number>, p: Pt): boolean => inMap(m, p) && !blocked.has(key(m, p));

export function buildLayout(m: V2Map): V2Layout {
  const blocked = blockedTiles(m);
  const points = objects(m).filter((o) => o.point).map((o) => ({ o, p: propsOf(o) }));
  const desks: DeskSpot[] = points
    .filter(({ p }) => p.kind === undefined && p.project !== undefined)
    .map(({ o, p }) => ({ tile: tileOf(m, o), face: faceOf(p.face), house: String(p.project), seat: Number(p.seat), bot: typeof p.bot === 'string' && p.bot ? p.bot : null }))
    .sort((a, b) => a.house.localeCompare(b.house) || a.seat - b.seat);
  const chairs: ChairSpot[] = points
    .filter(({ p }) => p.kind === undefined && p.room === MEETING_ROOM)
    .map(({ o, p }) => ({ tile: tileOf(m, o), face: faceOf(p.face), seat: Number(p.seat), moderator: p.role === 'moderator' }))
    .sort((a, b) => a.seat - b.seat);
  const spawnObj = points.find(({ p }) => p.kind === 'plaza-spawn' && p.role === 'avatar');
  const centerObj = points.find(({ p }) => p.kind === 'plaza-spawn' && p.role === 'center');
  const middle = { x: Math.floor(m.width / 2), y: Math.floor(m.height / 2) };
  const spawn = spawnObj ? tileOf(m, spawnObj.o) : middle;
  const center = centerObj ? tileOf(m, centerObj.o) : spawn;
  const reach = reachable(m, blocked, spawn);
  const rx = Math.max(1, Number(centerObj?.p.rx) || 3);
  const ry = Math.max(1, Number(centerObj?.p.ry) || 2);
  const ring: { p: Pt; d: number }[] = [];
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const p = { x: center.x + dx, y: center.y + dy };
      const d = (dx / rx) ** 2 + (dy / ry) ** 2;
      if (d > 1 || Math.abs(dx + dy) % 2 !== 0) continue;
      if (!inMap(m, p) || !reach.has(key(m, p)) || (p.x === spawn.x && p.y === spawn.y)) continue;
      ring.push({ p, d });
    }
  }
  ring.sort((a, b) => a.d - b.d || a.p.y - b.p.y || a.p.x - b.p.x);
  return { map: m, blocked, reach, desks, chairs, plaza: ring.length > 0 ? ring.map((r) => r.p) : [spawn], spawn, center };
}

export function standPoint(m: V2Map, tile: Pt): Pt {
  return { x: tile.x * m.tilewidth + m.tilewidth / 2, y: (tile.y + 1) * m.tileheight - FOOT_PAD };
}

export function seatPoint(m: V2Map, tile: Pt, seated: boolean): Pt {
  return { x: tile.x * m.tilewidth + m.tilewidth / 2, y: (tile.y + 1) * m.tileheight - (seated ? SEAT_DROP : FOOT_PAD) };
}

export const tileAt = (m: V2Map, x: number, y: number): Pt => ({ x: Math.floor(x / m.tilewidth), y: Math.floor(y / m.tileheight) });

export function groundProps(m: V2Map, x: number, y: number): Record<string, string | number | boolean> | undefined {
  const t = tileAt(m, x, y);
  if (t.x < 0 || t.y < 0 || t.x >= m.width || t.y >= m.height) return undefined;
  const gid = m.layers.find((l) => l.type === 'tilelayer' && l.name === 'ground')?.data?.[t.y * m.width + t.x];
  if (!gid) return undefined;
  const ts = [...m.tilesets].reverse().find((s) => s.firstgid <= gid);
  const tile = ts?.tiles?.find((x2) => x2.id === gid - ts.firstgid);
  return tile ? propsOf(tile) : undefined;
}

export function resolveSeats(l: V2Layout, npcs: readonly SeatNpc[]): Map<string, Seat> {
  const out = new Map<string, Seat>();
  const taken = new Set<number>();
  const sit = (id: string, kind: SeatKind, tile: Pt, face: Face4): void => {
    const seated = kind !== 'plaza';
    taken.add(key(l.map, tile));
    out.set(id, { kind, tile, face, seated, ...seatPoint(l.map, tile, seated) });
  };
  const free = (tile: Pt): boolean => !taken.has(key(l.map, tile));

  const meeting = npcs.filter((n) => n.meeting);
  const head = l.chairs.find((c) => c.moderator) ?? l.chairs[0];
  const moderator = meeting.find((n) => n.moderator);
  if (moderator && head) sit(moderator.id, 'chair', head.tile, head.face);
  const rest = [...l.chairs.filter((c) => c !== head), ...(head ? [head] : [])];
  for (const n of meeting) {
    if (out.has(n.id)) continue;
    const c = rest.find((x) => free(x.tile));
    if (c) sit(n.id, 'chair', c.tile, c.face);
  }

  const pending = (): SeatNpc[] => npcs.filter((n) => !out.has(n.id) && !n.onBreak);
  for (const n of pending()) {
    const d = l.desks.find((x) => (x.bot === n.id || (n.name !== undefined && x.bot === botId(n.name))) && free(x.tile));
    if (d) sit(n.id, 'desk', d.tile, d.face);
  }
  for (const n of pending()) {
    const seat = n.seatV2 ?? n.homeSeat;
    if (seat === undefined) continue;
    const d = l.desks.find((x) => x.house === (n.homeV2 ?? n.home) && x.seat === seat && free(x.tile));
    if (d) sit(n.id, 'desk', d.tile, d.face);
  }
  for (const n of pending()) {
    const d = l.desks.find((x) => x.house === (n.homeV2 ?? n.home) && x.bot === null && free(x.tile));
    if (d) sit(n.id, 'desk', d.tile, d.face);
  }

  let i = 0;
  for (const n of npcs) {
    if (out.has(n.id)) continue;
    sit(n.id, 'plaza', l.plaza[i % l.plaza.length]!, 'down');
    i++;
  }
  return out;
}

export const clampZoomV2 = (z: number): number => Math.min(MAX_ZOOM_V2, Math.max(MIN_ZOOM_V2, Math.round(z) || MIN_ZOOM_V2));

export const stepZoomV2 = (z: number, dir: number): number => clampZoomV2(Math.round(z) + Math.sign(dir));

export function pickZoom(viewW: number, viewH: number, tile: number, minX: number = VIEW_TILES.x, minY: number = VIEW_TILES.y): number {
  if (viewW <= 0 || viewH <= 0 || tile <= 0) return MIN_ZOOM_V2;
  return clampZoomV2(Math.floor(Math.min(viewW / (tile * minX), viewH / (tile * minY))));
}

export function fitZoomV2(viewW: number, viewH: number, worldW: number, worldH: number): number {
  if (viewW <= 0 || viewH <= 0 || worldW <= 0 || worldH <= 0) return MIN_ZOOM_V2;
  return clampZoomV2(Math.floor(Math.min(viewW / worldW, viewH / worldH)));
}

export interface V2Depths { layers: Record<string, number>; charBase: number; labels: number; fx: number }

export function depthsFor(m: V2Map): V2Depths {
  const charBase = 100;
  const top = charBase + m.height * m.tileheight + m.tileheight;
  return {
    layers: { ground: 0, ground2: 1, walls: 2, furniture_low: 3, furniture_high: top + 1, lights: top + 2 },
    charBase,
    fx: top + 3,
    labels: top + 10,
  };
}

export const charDepth = (d: V2Depths, y: number): number => d.charBase + y;

export function findPathV2(m: V2Map, blocked: Set<number>, from: Pt, to: Pt): Pt[] {
  if (!isWalkable(m, blocked, to) || !inMap(m, from)) return [];
  const start = key(m, from);
  const goal = key(m, to);
  if (start === goal) return [];
  const prev = new Map<number, number>([[start, -1]]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    if (cur === goal) break;
    const cx = cur % m.width;
    const cy = Math.floor(cur / m.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const p = { x: cx + dx, y: cy + dy };
      if (!isWalkable(m, blocked, p)) continue;
      const k = key(m, p);
      if (prev.has(k)) continue;
      prev.set(k, cur);
      queue.push(k);
    }
  }
  if (!prev.has(goal)) return [];
  const path: Pt[] = [];
  for (let k = goal; k !== start; k = prev.get(k)!) path.push({ x: k % m.width, y: Math.floor(k / m.width) });
  return path.reverse();
}

export function nearestReachable(m: V2Map, reach: Set<number>, to: Pt, radius = 2): Pt | null {
  let best: Pt | null = null;
  let bestD = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const p = { x: to.x + dx, y: to.y + dy };
      if (!inMap(m, p) || !reach.has(key(m, p))) continue;
      const d = dx * dx + dy * dy + (dy > 0 ? 0 : 0.1);
      if (d < bestD) { best = p; bestD = d; }
    }
  }
  return best;
}

export function boxBlocked(m: V2Map, blocked: Set<number>, x: number, y: number, halfW: number, h: number): boolean {
  return [[-halfW, -1], [halfW, -1], [-halfW, -h], [halfW, -h]].some(([dx, dy]) => !isWalkable(m, blocked, tileAt(m, x + dx!, y + dy!)));
}

export function botAnim(mode: BotMode, seat: Pick<Seat, 'kind' | 'seated'>, moderator = false): BotAnim {
  if (seat.kind === 'chair') return moderator ? 'talk' : 'sit';
  if (seat.seated) return mode === 'working' ? 'type' : mode === 'waiting' ? 'talk' : 'sit';
  return mode === 'waiting' ? 'talk' : 'idle';
}

export function animFrames(meta: BotsMeta, anim: string, face: Face4): { start: number; end: number; fps: number } | null {
  const def = meta.animations[anim];
  const row = def?.rows[face];
  if (!def || row === undefined) return null;
  const start = row * meta.sheet.columns;
  return { start, end: start + def.frames - 1, fps: def.fps };
}

export const animKey = (sheet: string, anim: string, face: Face4): string => `v2:${sheet}:${anim}:${face}`;

const SHEET_RE = /^[a-z0-9-]{1,24}$/;
export const AVATAR_SHEET = 'deck';

export function sheetFor(meta: BotsMeta, sprite: string | undefined, id: string): string {
  const has = (k: string | undefined): boolean => !!k && SHEET_RE.test(k) && Object.prototype.hasOwnProperty.call(meta.bots, k);
  if (sprite !== undefined && has(sprite)) return sprite;
  if (has(id)) return id;
  const pool = Object.keys(meta.bots).filter((k) => k !== AVATAR_SHEET).sort();
  if (pool.length === 0) return AVATAR_SHEET;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return pool[h % pool.length]!;
}

export type PcState = 'on' | 'alert' | 'off';
export const pcState = (mode: BotMode): PcState => (mode === 'working' ? 'on' : mode === 'waiting' ? 'alert' : 'off');
export const pcAnimName = (view: string, state: PcState): string => `${view === 'back' ? 'back' : 'front'}_${state}`;

export function frameAt<T>(frames: readonly T[], fps: number, now: number): T | undefined {
  if (frames.length === 0) return undefined;
  return frames[Math.floor((now * Math.max(1, fps)) / 1000) % frames.length];
}

export interface TileAnim { frames: number[]; total: number; durations: number[] }

export function tileAnimations(m: V2Map): Map<number, TileAnim> {
  const out = new Map<number, TileAnim>();
  for (const ts of m.tilesets) {
    for (const t of ts.tiles ?? []) {
      const anim = (t as { animation?: { tileid: number; duration: number }[] }).animation;
      if (!anim || anim.length < 2) continue;
      const durations = anim.map((a) => Math.max(1, a.duration));
      out.set(ts.firstgid + t.id, { frames: anim.map((a) => ts.firstgid + a.tileid), durations, total: durations.reduce((s, d) => s + d, 0) });
    }
  }
  return out;
}

export function tileAnimFrame(a: TileAnim, now: number): number {
  let t = now % a.total;
  for (let i = 0; i < a.frames.length; i++) {
    if (t < a.durations[i]!) return a.frames[i]!;
    t -= a.durations[i]!;
  }
  return a.frames[0]!;
}

export function isTypingTarget(el: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!el) return false;
  const tag = (el.tagName ?? '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

export function isWorldV2(search: string, stored: string | null | undefined): boolean {
  const q = new URLSearchParams(search).get('v2');
  if (q === '1') return true;
  if (q === '0') return false;
  return stored === '1';
}

export const WORLD_V2_STORAGE_KEY = 'deck.world.v2';

export function gaitAnim(meta: BotsMeta, running: boolean): { anim: BotAnim; scale: number } {
  if (!running) return { anim: 'walk', scale: 1 };
  return meta.animations.run ? { anim: 'run', scale: 1 } : { anim: 'walk', scale: 1.6 };
}
