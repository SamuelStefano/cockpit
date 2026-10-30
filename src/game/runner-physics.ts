export const W = 640;
export const H = 200;
export const GROUND = 164;
export const BIT = { x: 56, w: 34, h: 38 } as const;

const GRAVITY = 2000;
const JUMP_V = 640;
const START_SPEED = 260;
const MAX_SPEED = 640;
const ACCEL = 9;
const MAX_DT = 0.05;
const TOKEN = 18;

export type ObstacleKind = 'bug' | 'conflict';
export interface Obstacle { x: number; w: number; h: number; kind: ObstacleKind }
export interface Token { x: number; y: number }

export interface RunState {
  // Height of Bit's feet above the ground (0 = standing).
  y: number;
  vy: number;
  speed: number;
  dist: number;
  obstacles: Obstacle[];
  tokens: Token[];
  collected: number;
  // Distance left until the next obstacle spawns at the right edge.
  nextSpawn: number;
  time: number;
  over: boolean;
}

export const initRun = (): RunState => ({ y: 0, vy: 0, speed: START_SPEED, dist: 0, obstacles: [], tokens: [], collected: 0, nextSpawn: 420, time: 0, over: false });

export const onGround = (s: RunState): boolean => s.y <= 0 && s.vy <= 0;

export function jump(s: RunState): RunState {
  if (s.over || !onGround(s)) return s;
  return { ...s, vy: JUMP_V };
}

export const runScore = (s: RunState): number => Math.floor(s.dist / 8) + s.collected * 10;

interface Rect { x: number; y: number; w: number; h: number }
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Hitboxes are smaller than the sprites so a graze on a corner is forgiven.
export const bitRect = (s: RunState): Rect => ({ x: BIT.x + 6, y: GROUND - s.y - BIT.h + 5, w: BIT.w - 12, h: BIT.h - 9 });
const obstacleRect = (o: Obstacle): Rect => ({ x: o.x + 3, y: GROUND - o.h + 3, w: o.w - 6, h: o.h - 3 });
const tokenRect = (t: Token): Rect => ({ x: t.x, y: GROUND - t.y - TOKEN, w: TOKEN, h: TOKEN });

function spawn(s: RunState, rng: () => number): Pick<RunState, 'obstacles' | 'tokens' | 'nextSpawn'> {
  const conflict = rng() < 0.4;
  const obstacle: Obstacle = conflict
    ? { x: W + 10, w: 46, h: 30, kind: 'conflict' }
    : { x: W + 10, w: 30, h: 28 + Math.floor(rng() * 14), kind: 'bug' };
  const tokens = [...s.tokens];
  if (rng() < 0.6) tokens.push({ x: W + 10 + obstacle.w / 2 - TOKEN / 2, y: 60 + Math.floor(rng() * 40) });
  // The gap grows with speed so the jump arc (about 0.64s) always has room to land.
  const gap = s.speed * 0.75 + 90 + rng() * s.speed * 0.6;
  return { obstacles: [...s.obstacles, obstacle], tokens, nextSpawn: gap };
}

export function stepRun(prev: RunState, dtRaw: number, rng: () => number = Math.random): RunState {
  if (prev.over) return prev;
  const dt = Math.min(Math.max(dtRaw, 0), MAX_DT);
  let vy = prev.vy - GRAVITY * dt;
  let y = prev.y + vy * dt;
  if (y <= 0) { y = 0; vy = 0; }
  const speed = Math.min(MAX_SPEED, prev.speed + ACCEL * dt);
  const dx = speed * dt;
  let s: RunState = {
    ...prev, y, vy, speed, dist: prev.dist + dx, time: prev.time + dt,
    obstacles: prev.obstacles.map((o) => ({ ...o, x: o.x - dx })).filter((o) => o.x + o.w > -10),
    tokens: prev.tokens.map((t) => ({ ...t, x: t.x - dx })).filter((t) => t.x + TOKEN > -10),
    nextSpawn: prev.nextSpawn - dx,
  };
  if (s.nextSpawn <= 0) s = { ...s, ...spawn(s, rng) };

  const bit = bitRect(s);
  const before = s.tokens.length;
  const tokens = s.tokens.filter((t) => !overlap(bit, tokenRect(t)));
  if (tokens.length !== before) s = { ...s, tokens, collected: s.collected + (before - tokens.length) };
  if (s.obstacles.some((o) => overlap(bit, obstacleRect(o)))) s = { ...s, over: true };
  return s;
}

export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
