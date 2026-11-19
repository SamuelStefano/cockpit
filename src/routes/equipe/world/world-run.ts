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

export type Surface = 'grass' | 'dirt' | 'sand' | 'wood' | 'paved' | 'floor' | 'water' | 'unknown';

// Ground item names of the v2 tilesets (tiles-exterior.json / tiles-interior.json), first match wins.
const SURFACE_RULES: ReadonlyArray<readonly [RegExp, Surface]> = [
  [/^(grass|auto_grass_path|auto_grass_sand)/, 'grass'],
  [/^dirt/, 'dirt'],
  [/^(sand|auto_sand_water)/, 'sand'],
  [/^dock_/, 'wood'],
  [/^(plaza|auto_grass_plaza|street|road|crosswalk|sidewalk|rock_ground|cliff)/, 'paved'],
  [/^(floor|carpet)/, 'floor'],
  [/^water/, 'water'],
];

export function surfaceOfItem(name: string | undefined): Surface {
  if (!name) return 'unknown';
  return SURFACE_RULES.find(([re]) => re.test(name))?.[1] ?? 'unknown';
}

const SURFACES: ReadonlySet<string> = new Set(['grass', 'dirt', 'sand', 'wood', 'paved', 'floor', 'water']);

// Tile properties of the ground tile under the feet: `surface` when the tileset declares it, else the
// `floor` flag of the old map (plaza, street and indoor floors).
export function surfaceOfProps(props: Record<string, unknown> | undefined): Surface {
  if (!props) return 'unknown';
  if (typeof props.surface === 'string') return SURFACES.has(props.surface) ? (props.surface as Surface) : 'unknown';
  return props.floor === true ? 'floor' : 'unknown';
}

// Dust rises only from loose ground; a surface the map does not describe keeps the puff.
export const dustAllowed = (surface: Surface): boolean => surface === 'grass' || surface === 'dirt' || surface === 'sand' || surface === 'unknown';

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
