import type { FloorAgent, Point, SectorId, SectorRow, Wing } from './types';

export interface SectorDef { id: SectorId; name: string; hotkey: string; color: number; css: string; x0: number; x1: number; z0: number; z1: number }

export const SECTORS: SectorDef[] = [
  { id: 'intake', name: 'INTAKE', hotkey: 'I', color: 0xe2b23c, css: '#e2b23c', x0: -66, x1: -46, z0: -15, z1: 3 },
  { id: 'build', name: 'BUILD', hotkey: 'B', color: 0xc8603c, css: '#e07a55', x0: -46, x1: 46, z0: -15, z1: 3 },
  { id: 'ship', name: 'SHIP', hotkey: 'S', color: 0x3f6fa8, css: '#7cb0ec', x0: -46, x1: 66, z0: 3, z1: 15 },
  { id: 'ops', name: 'OPS', hotkey: 'O', color: 0x2f7f79, css: '#59c2ba', x0: 46, x1: 66, z0: -15, z1: 3 },
  { id: 'archive', name: 'ARCHIVE', hotkey: 'R', color: 0x7d5bbe, css: '#b79bff', x0: -66, x1: -46, z0: 3, z1: 15 },
];

export const sectorCenter = (s: SectorDef): Point => ({ x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 });
export const sectorById = (id: SectorId): SectorDef => SECTORS.find((s) => s.id === id) ?? SECTORS[0];

export const COL_WIDTH = 9;
export const MAX_COLS = 10;
export const SLOTS_PER_COL = 2;
const FIRST_COL_X = -41;
const ROW_Z = [-2.5, -9.5];
const RUGS = [0xb6805f, 0x5f8a7f, 0x7a6aa1, 0x8a8a5a, 0x6f7f9a, 0xa0705f, 0x5f8f6f, 0x8f6f8f];
const HOTKEYS = ['Z', 'X', 'C', 'V'];
export const OTHER_WING_ID = 'other';

export function slotPosition(wing: Pick<Wing, 'colStart'>, slot: number): Point {
  const col = wing.colStart + Math.floor(slot / SLOTS_PER_COL);
  return { x: FIRST_COL_X + col * COL_WIDTH, z: ROW_Z[slot % SLOTS_PER_COL] };
}

export interface WingGroup { id: string; name: string; count: number }
const colsFor = (count: number) => Math.max(1, Math.ceil(count / SLOTS_PER_COL));

// Order is the caller's first-seen order, so wings do not swap places as counts change.
// Smallest groups fold into "Other" when the floor runs out of columns.
export function layoutWings(groups: WingGroup[], maxCols = MAX_COLS): { wings: Wing[]; folded: Record<string, string> } {
  const kept = groups.map((g) => ({ ...g }));
  const folded: Record<string, string> = {};
  const total = () => kept.reduce((n, g) => n + colsFor(g.count), 0);
  while (total() > maxCols) {
    const candidates = kept.filter((g) => g.id !== OTHER_WING_ID);
    if (candidates.length < 2) break;
    const small = candidates.reduce((a, b) => (b.count < a.count ? b : a));
    kept.splice(kept.indexOf(small), 1);
    folded[small.id] = OTHER_WING_ID;
    const other = kept.find((g) => g.id === OTHER_WING_ID);
    if (other) other.count += small.count;
    else kept.push({ id: OTHER_WING_ID, name: 'Other projects', count: small.count });
  }
  let col = 0;
  const wings = kept.map((g, i): Wing => {
    const cols = colsFor(g.count), colStart = col;
    col += cols;
    return { id: g.id, name: g.name, count: g.count, colStart, cols, width: cols * COL_WIDTH, cx: FIRST_COL_X + colStart * COL_WIDTH + ((cols - 1) * COL_WIDTH) / 2, rug: RUGS[i % RUGS.length], hotkey: HOTKEYS[i] };
  });
  return { wings, folded };
}

export function sectorRows(agents: Pick<FloorAgent, 'sector' | 'state'>[], extra: Partial<Record<SectorId, Partial<Pick<SectorRow, 'busy' | 'stuck' | 'waiting'>>>> = {}): SectorRow[] {
  return SECTORS.map((s) => {
    const mine = agents.filter((a) => a.sector === s.id), add = extra[s.id] ?? {};
    return {
      id: s.id, name: s.name, hotkey: s.hotkey, color: s.css,
      busy: mine.filter((a) => a.state === 'working' || a.state === 'thinking' || a.state === 'reviewing').length + (add.busy ?? 0),
      stuck: mine.filter((a) => a.state === 'blocked' || a.state === 'silent' || a.state === 'asleep').length + (add.stuck ?? 0),
      waiting: mine.filter((a) => a.state === 'waiting' || a.state === 'paused' || a.state === 'finished').length + (add.waiting ?? 0),
    };
  });
}
