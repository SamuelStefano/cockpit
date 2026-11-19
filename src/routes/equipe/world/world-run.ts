export const RUN_MULT = 1.6;
export const WALK_FRAME_MS = 130;
export const RUN_FRAME_MS = 80;
export const DUST_INTERVAL_MS = 120;
export const DUST_POOL = 8;
export const DUST_FRAME = 16;
export const DUST_FRAMES = 6;
export const DUST_FPS = 14;
export const DUST_ANCHOR = { x: 8, y: 14 };
export const LOOKAHEAD_MAX = 48;
export const LOOKAHEAD_EASE_MS = 260;
export const STICK_RUN_THRESHOLD = 0.9;

export const runSpeed = (base: number, running: boolean): number => (running ? base * RUN_MULT : base);

export const legFrameMs = (running: boolean): number => (running ? RUN_FRAME_MS : WALK_FRAME_MS);

// Stick deflection as a fraction of its radius (0..1).
export const stickRuns = (magnitude: number): boolean => magnitude >= STICK_RUN_THRESHOLD;

export interface DustTick { count: number; acc: number }

// The first puff comes one full interval after the run starts; stopping resets the clock.
export function dustTick(acc: number, dtMs: number, active: boolean): DustTick {
  if (!active || dtMs <= 0) return { count: 0, acc: active ? acc : 0 };
  const total = acc + dtMs;
  const count = Math.floor(total / DUST_INTERVAL_MS);
  return { count: Math.min(count, DUST_POOL), acc: total - count * DUST_INTERVAL_MS };
}

export interface Offset { x: number; y: number }

// Frame-rate independent ease of the camera offset toward `dir * max`; dir (0, 0) eases back to rest.
export function lookahead(prev: Offset, dirX: number, dirY: number, dtMs: number, max = LOOKAHEAD_MAX): Offset {
  const len = Math.hypot(dirX, dirY);
  const tx = len > 0 ? (dirX / len) * max : 0;
  const ty = len > 0 ? (dirY / len) * max : 0;
  const k = 1 - Math.exp(-Math.max(0, dtMs) / LOOKAHEAD_EASE_MS);
  let x = prev.x + (tx - prev.x) * k;
  let y = prev.y + (ty - prev.y) * k;
  const mag = Math.hypot(x, y);
  if (mag > max) { x = (x / mag) * max; y = (y / mag) * max; }
  if (len === 0 && Math.hypot(x, y) < 0.05) return { x: 0, y: 0 };
  return { x, y };
}
