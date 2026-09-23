import { shellNodeId, type CanvasNode, type CanvasPos } from '../../../shared/canvas';
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

// tmux names are capped at 32 chars by the server allow-list, so the uuid is
// folded to its first 24 hex digits — plenty to stay unique across sessions.
export const watchTermId = (sessionId: string) => WATCH_PREFIX + sessionId.replace(/-/g, '').slice(0, 24);
export const isWatchTerm = (termId: string) => termId.startsWith(WATCH_PREFIX);
export const newShellId = (rand: number) => SHELL_PREFIX + Math.floor(rand * 36 ** 6).toString(36).padStart(6, '0');

export function shellNodes(termIds: string[], now: number): CanvasNode[] {
  return termIds
    .filter((id) => !isWatchTerm(id))
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
  const taken: Rect[] = windows.filter((id) => saved[id]).map((id) => ({ ...saved[id], w: TERM_W, h: TERM_H }));
  for (const id of windows) {
    if (saved[id]) { out[id] = saved[id]; continue; }
    const slot = laneSlot(map, taken);
    out[id] = slot;
    taken.push({ ...slot, w: TERM_W, h: TERM_H });
  }
  return out;
}
