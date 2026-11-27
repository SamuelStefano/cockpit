import type { Face } from './world-map';

export const HOOK_X = [10, 23, 36] as const;
export const MAX_PLAQUES = 3;
export const BOARD_PX = { w: 48, h: 32 } as const;
export const PLAQUE_FRAME = 15;
export const TASKBOX_FRAME_GROUND = 4;

const TASKBOX_FRAME: Record<Face, number> = { left: 0, down: 1, up: 2, right: 3 };
export const taskboxFrame = (face: Face): number => TASKBOX_FRAME[face];

export type ErrandStep = 'goBoard' | 'pickup' | 'goDesk' | 'setdown' | 'hang' | 'goHome';
export type ErrandKind = 'start' | 'finish';
export interface Errand { kind: ErrandKind; step: number }

const STEPS: Record<ErrandKind, readonly ErrandStep[]> = {
  start: ['goBoard', 'pickup', 'goDesk', 'setdown'],
  finish: ['goBoard', 'hang', 'goHome'],
};

export const newErrand = (kind: ErrandKind): Errand => ({ kind, step: 0 });
export const stepOf = (e: Errand): ErrandStep => STEPS[e.kind][e.step]!;
export const advance = (e: Errand): Errand | null => (e.step + 1 >= STEPS[e.kind].length ? null : { kind: e.kind, step: e.step + 1 });
export const isCarrying = (e: Errand | null): boolean => !!e && e.kind === 'start' && stepOf(e) === 'goDesk';

export interface DoingEdges { started: string[]; stopped: string[]; next: Map<string, boolean> }

// A bot seen for the first time only records its flag: nothing replays on load.
export function doingEdges(prev: ReadonlyMap<string, boolean>, npcs: readonly { id: string; doing?: boolean }[]): DoingEdges {
  const started: string[] = [];
  const stopped: string[] = [];
  const next = new Map<string, boolean>();
  for (const n of npcs) {
    const now = n.doing === true;
    const before = prev.get(n.id);
    if (before !== undefined && before !== now) (now ? started : stopped).push(n.id);
    next.set(n.id, now);
  }
  return { started, stopped, next };
}

export interface Plaque { hook: number; serial: number }
export interface PlaqueUpdate { list: Plaque[]; hook: number; removed: Plaque | null }

// The next free hook; with all three taken the oldest plaque is replaced and its hook reused.
export function hangPlaque(list: readonly Plaque[], serial: number): PlaqueUpdate {
  const used = new Set(list.map((p) => p.hook));
  const free = HOOK_X.findIndex((_, i) => !used.has(i));
  if (free >= 0 && list.length < MAX_PLAQUES) return { list: [...list, { hook: free, serial }], hook: free, removed: null };
  const [oldest, ...rest] = [...list].sort((a, b) => a.serial - b.serial);
  const hook = oldest!.hook;
  return { list: [...rest, { hook, serial }], hook, removed: oldest! };
}

// Top-centre of a plaque in world px, given the board's top-left tile (the 3x2 cork board).
export function plaquePos(boardLeftPx: number, boardBottomPx: number, hook: number): { x: number; y: number } {
  return { x: boardLeftPx + HOOK_X[hook]!, y: boardBottomPx - 6 };
}
