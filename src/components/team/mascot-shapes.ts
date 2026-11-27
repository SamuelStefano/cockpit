import type { MascotShape } from '../../../shared/protocol';

// 64×64 viewBox. `eyes` is the face anchor per body so the face sits on the
// visual mass of each silhouette, not the box center.
export interface ShapeDef { body: string; eyes: [number, number]; gap: number }

export const MASCOT_SHAPES: Record<MascotShape, ShapeDef> = {
  drop: { body: 'M32 5C24 15 10 25 10 39a22 22 0 0 0 44 0C54 25 40 15 32 5Z', eyes: [32, 40], gap: 12 },
  blob: { body: 'M32 8c14 0 24 9 24 23 0 15-10 25-24 25S8 47 8 32 18 8 32 8Z', eyes: [32, 31], gap: 12 },
  tri: { body: 'M15 9c-4 0-7 3-7 8v31c0 6 6 9 11 6l35-17c5-2 5-9 0-11L19 9.5c-1.3-.6-2.6-.7-4-.5Z', eyes: [24, 32], gap: 11 },
  bean: { body: 'M20 13c10-8 30-5 34 10 4 13-2 29-18 31-15 2-28-6-28-20 0-9 5-16 12-21Z', eyes: [31, 32], gap: 12 },
};

export const MASCOT_COLORS = ['#22c55e', '#14b8a6', '#a16207', '#f97316', '#8b5cf6', '#ec4899', '#3b82f6', '#eab308'];
