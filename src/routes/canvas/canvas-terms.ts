import { shellNodeId, watchTermId, type CanvasNode, type CanvasPos } from '../../../shared/canvas';
import { bounds } from './canvas-layout';

// Terminal windows on the canvas. A session node opens a "watch" tmux pane that
// follows its transcript live; a shell node is any other cockpit-* tmux session.
// Both are sized in world pixels, so zoom scales them like every other node.

export const TERM_W = 640;
export const TERM_H = 400;
export const MAX_OPEN_TERMS = 8;
const LANE_GAP = 40;
const LANE_ABOVE = 160;
const LANE_COLS = 3;

const WATCH_PREFIX = 'w-';
const SHELL_PREFIX = 'cv-';

export { watchTermId };
export const isWatchTerm = (termId: string) => termId.startsWith(WATCH_PREFIX);
export const isCanvasShell = (termId: string) => termId.startsWith(SHELL_PREFIX);
export const newShellId = (rand: number) => SHELL_PREFIX + Math.floor(rand * 36 ** 6).toString(36).padStart(6, '0');

// Only shells born on the canvas: `main`/`term-NNN` belong to the side panel,
// and a window here would resize (or kill) the terminal the user has open there.
export function shellNodes(termIds: string[], now: number): CanvasNode[] {
  return termIds
    .filter(isCanvasShell)
    .sort()
    .map((id) => ({ id: shellNodeId(id), kind: 'shell' as const, ref: id, title: id, subtitle: 'tmux', mtime: now }));
}

export interface Rect { x: number; y: number; w: number; h: number }

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// A freshly opened terminal goes to a grid above the map, in the first slot no
// other open window already covers, so opening a fifth never lands on top of
// the four already there and the map below is left untouched. Three columns
// keep a handful of windows framed at a zoom where the text is still legible.
export function laneSlot(map: Rect, taken: Rect[]): CanvasPos {
  for (let i = 0; ; i++) {
    const r = {
      x: map.x + (i % LANE_COLS) * (TERM_W + LANE_GAP),
      y: map.y - LANE_ABOVE - TERM_H - Math.floor(i / LANE_COLS) * (TERM_H + LANE_GAP),
      w: TERM_W, h: TERM_H,
    };
    if (!taken.some((t) => overlaps(t, r))) return { x: r.x, y: r.y };
  }
}

// A session's window and its card are two places on the map: the card orbits
// its contexts, the window sits wherever it was opened or dragged. Shells only
// ever exist as windows, so they keep their node id.
export const winKey = (id: string) => (id.startsWith('s:') ? `w:${id.slice(2)}` : id);

// Least recently focused goes first when the cap is hit; the newest id is
// always kept.
export function capOpen(order: string[], id: string, max = MAX_OPEN_TERMS): string[] {
  const next = [...order.filter((x) => x !== id), id];
  return next.length > max ? next.slice(next.length - max) : next;
}

// Windows the user dragged keep their spot; the rest queue up in the lane. The
// map rect ignores windows so the lane never drifts up as more of them open.
export function placeWindows(pos: Record<string, CanvasPos>, saved: Record<string, CanvasPos>, windows: string[]): Record<string, CanvasPos> {
  const win = new Set(windows);
  const map = bounds(Object.entries(pos).filter(([id]) => !win.has(id)).map(([, p]) => p));
  const out = { ...pos };
  const taken: Rect[] = windows.filter((id) => saved[winKey(id)]).map((id) => ({ ...saved[winKey(id)], w: TERM_W, h: TERM_H }));
  for (const id of windows) {
    const at = saved[winKey(id)];
    if (at) { out[id] = at; continue; }
    const slot = laneSlot(map, taken);
    out[id] = slot;
    taken.push({ ...slot, w: TERM_W, h: TERM_H });
  }
  return out;
}

// Running sessions open on their own, but only into free room or by pushing out
// a window that is NOT running: evicting one running window to admit another
// would re-trigger the opener forever once more than `max` run at once.
export function autoAdd(cur: string[], running: string[], max = MAX_OPEN_TERMS): string[] {
  const live = new Set(running);
  let next = cur;
  for (const id of running) {
    if (next.includes(id)) continue;
    if (next.length >= max) {
      const victim = next.find((x) => !live.has(x));
      if (!victim) break;
      next = next.filter((x) => x !== victim);
    }
    next = [...next, id];
  }
  return next;
}
