import type { Face } from './world-map';

export const CHIBI_VARIANTS = 8;
export const CHIBI_COLS = 24;
export const CHIBI_FRAME_W = 16;
export const CHIBI_FRAME_H = 22;
export const FX_FRAME = 16;
export const WALK_FRAME_MS = 130;
export const STRETCH_MS = 600;

const DIR: Record<Face, number> = { left: 0, down: 1, up: 2, right: 3 };
const DEFAULT_SHIRT = 0xb8c4d6;

export const chibiFrame = (variant: number, face: Face, anim: number): number => variant * CHIBI_COLS + DIR[face] * 6 + anim;

export const walkAnim = (nowMs: number): number => 2 + (Math.floor(nowMs / WALK_FRAME_MS) % 4);

export const idleAnim = (nowMs: number): number => Math.floor(nowMs / STRETCH_MS) % 2;

export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Only a strict #rrggbb string becomes a tint; anything else gets the neutral shirt.
export function shirtTint(color: string | undefined): number {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? parseInt(color.slice(1), 16) : DEFAULT_SHIRT;
}

export interface VariantInput { id: string; station: string }

// Greedy over spot order. Each bot starts from its previous variant (or its id hash) and moves to the
// next free one while the bot before it at the same station, or the last seat wrapping a ring, has it.
export function assignVariants(spots: readonly VariantInput[], prev: ReadonlyMap<string, number> = new Map()): Map<string, number> {
  const out = new Map<string, number>();
  const byStation = new Map<string, string[]>();
  for (const s of spots) byStation.set(s.station, [...(byStation.get(s.station) ?? []), s.id]);
  const seen = new Map<string, number>();
  for (const s of spots) {
    const row = byStation.get(s.station)!;
    const i = seen.get(s.station) ?? 0;
    seen.set(s.station, i + 1);
    const neighbours = new Set<number>();
    const before = i > 0 ? out.get(row[i - 1]!) : undefined;
    if (before !== undefined) neighbours.add(before);
    if (i === row.length - 1 && row.length > 2) { const first = out.get(row[0]!); if (first !== undefined) neighbours.add(first); }
    const start = prev.get(s.id) ?? hashId(s.id) % CHIBI_VARIANTS;
    let v = start;
    for (let k = 0; k < CHIBI_VARIANTS && neighbours.has(v); k++) v = (start + k + 1) % CHIBI_VARIANTS;
    out.set(s.id, v);
  }
  return out;
}
