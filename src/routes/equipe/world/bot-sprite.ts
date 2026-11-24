import type { Face } from './world-map';

const KEY_RE = /^[a-z0-9-]{1,24}$/;
const BUILTIN_KEYS = new Set(['town', 'dungeon', 'indoor', 'urban']);

export function spriteKey(raw: unknown): string | null {
  if (typeof raw !== 'string' || !KEY_RE.test(raw) || BUILTIN_KEYS.has(raw)) return null;
  return raw;
}

export const textureKey = (key: string): string => `bot-${key}`;
export const spritePath = (base: string, key: string): string => `${base}world/${key}.png`;

export const SHEET_FACE_COL: Record<Face, number> = { left: 0, down: 1, up: 2, right: 3 };
export const SHEET_COLS = 4;

export function sheetFrame(row: number, face: Face): number {
  return Math.max(0, Math.min(2, row)) * SHEET_COLS + SHEET_FACE_COL[face];
}

export function distinctSpriteKeys(bots: ReadonlyArray<{ sprite?: unknown }>): string[] {
  const out = new Set<string>();
  for (const b of bots) {
    const k = spriteKey(b.sprite);
    if (k) out.add(k);
  }
  return [...out];
}

// Village sheets (public/world/v2/bots/<id>.png, 32x48 frames): one row per facing, one column per frame.
export const V2_FRAME_W = 32;
export const V2_FRAME_H = 48;
export const V2_SHEET_COLS = 8;

export type Gait = 'walk' | 'run';

export interface SheetAnim { rows: Record<Face, number>; frames: number; fps: number }

// Mirrors bots.json; bot-sprite.test.ts fails when the generator moves a row.
export const V2_GAIT: Record<Gait, SheetAnim> = {
  walk: { rows: { left: 4, down: 5, up: 6, right: 7 }, frames: 6, fps: 10 },
  run: { rows: { left: 32, down: 33, up: 34, right: 35 }, frames: 6, fps: 12 },
};

export const gaitOf = (running: boolean): Gait => (running ? 'run' : 'walk');

// frameMs comes from legFrameMs(running) so the stride keeps the cadence of world-run.ts.
export function v2GaitFrame(running: boolean, face: Face, nowMs: number, frameMs: number): number {
  const a = V2_GAIT[gaitOf(running)];
  const i = Math.floor(Math.max(0, nowMs) / Math.max(1, frameMs)) % a.frames;
  return a.rows[face] * V2_SHEET_COLS + i;
}
