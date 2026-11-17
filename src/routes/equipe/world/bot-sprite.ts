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
