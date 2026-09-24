import { shellNodeId, watchTermId, type CanvasNode, type CanvasPos, type TermStats } from '../../../shared/canvas';
import { sessionAlert } from './canvas-alerts';
import { bounds } from './canvas-layout';

// Terminal windows on the canvas. A session node opens a "watch" tmux pane that
// follows its transcript live; a shell node is any other cockpit-* tmux session.
// Both are sized in world pixels, so zoom scales them like every other node.

export const TERM_W = 640;
export const TERM_H = 400;
// 6, not 8: LANE_COLS 2 keeps a full lane on screen at a legible zoom (canvas
// UX review 24/09 item 3) — 8 windows at 2 columns is 4 rows, taller than most
// laptop screens even floored at 0.75.
export const MAX_OPEN_TERMS = 6;
const LANE_GAP = 40;
const LANE_ABOVE = 160;
// 2, not 3: at TERM_W=640 a 3-col lane needs ~2000px, unreadable even floored
// at the new 0.75 minimum on a 1440px screen. 2 cols fits at 0.75 with room
// to spare (UX review 24/09 item 3).
const LANE_COLS = 2;

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

// Nearest free slot to `target`, snapped to the same TERM_W/TERM_H grid the
// lane uses — a spiral search (ring 0 = target itself, ring 1 = its 8
// neighbours, …) so the result is always the closest open cell, not just
// "the first one some arbitrary scan order hits". Terminates: a finite
// `taken` can never cover an infinite grid.
export function nudgeToFreeSlot(target: CanvasPos, taken: Rect[]): CanvasPos {
  const stepX = TERM_W + LANE_GAP;
  const stepY = TERM_H + LANE_GAP;
  const at = (dx: number, dy: number): Rect => ({ x: target.x + dx * stepX, y: target.y + dy * stepY, w: TERM_W, h: TERM_H });
  const free = (r: Rect) => !taken.some((t) => overlaps(t, r));
  if (free(at(0, 0))) return { x: target.x, y: target.y };
  for (let ring = 1; ring < 64; ring++) {
    const cells: [number, number][] = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) cells.push([dx, dy]);
      }
    }
    // Closest-by-Euclidean-distance first, so a ring picks its nearest cell
    // to `target` rather than whatever order the double loop produced.
    cells.sort((a, b) => (a[0] ** 2 + a[1] ** 2) - (b[0] ** 2 + b[1] ** 2));
    for (const [dx, dy] of cells) {
      const r = at(dx, dy);
      if (free(r)) return { x: r.x, y: r.y };
    }
  }
  return { x: target.x, y: target.y }; // unreachable in practice — see the 64-ring bound above
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
// `priority` (e.g. the orchestrator's window) goes through the queue FIRST,
// so on a fresh board it claims lane slot 0 — top-left, the most predictable
// spot — instead of wherever iteration order happens to put it.
//
// Windows must NEVER overlap (canvas review, 2026-09-24): a saved (dragged)
// position is still checked against every OTHER window already placed this
// pass — one dropped on top of another, or two whose saved spots happen to
// collide after a layout change, gets nudged to the nearest free slot
// (nudgeToFreeSlot) instead of silently stacking. This runs on every
// placeWindows call, so it covers first placement, a newly opened window, AND
// a fresh drag in one path — there's no separate "resolve collisions" step.
export function placeWindows(
  pos: Record<string, CanvasPos>, saved: Record<string, CanvasPos>, windows: string[], priority?: Set<string>,
  // Windows sharing an area queue up next to each other in the lane, so the
  // grid reads as loose per-area groups instead of arrival order (#598 map
  // cleanup) — absent id (a shell, no memory trail) sorts after every area.
  areaOf?: (id: string) => string | undefined,
): Record<string, CanvasPos> {
  const win = new Set(windows);
  const map = bounds(Object.entries(pos).filter(([id]) => !win.has(id)).map(([, p]) => p));
  const out = { ...pos };
  const taken: Rect[] = [];
  let ordered = windows;
  if (areaOf) ordered = [...ordered].sort((a, b) => (areaOf(a) ?? '￿').localeCompare(areaOf(b) ?? '￿'));
  if (priority?.size) ordered = [...ordered].sort((a, b) => Number(priority.has(b)) - Number(priority.has(a)));
  for (const id of ordered) {
    const at = saved[winKey(id)];
    const slot = at ? nudgeToFreeSlot(at, taken) : laneSlot(map, taken);
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

// "sessões" only has MAX_OPEN_TERMS slots — spend them on what needs eyes NOW
// (running, then waiting-on-user, then a context/error alert) before falling
// back to recency, so a stale ghost never bumps a session stuck waiting for
// input out of the cap (UX review 24/09 item 3). NOT wired up yet: Canvas.tsx
// still sorts by mtime alone (see this batch's PR body for the one-line call).
export function pickRecentSessions(
  nodes: CanvasNode[], running: Set<string>, waiting: Set<string>,
  stats: Record<string, Pick<TermStats, 'contextTokens' | 'model'>>, max = MAX_OPEN_TERMS,
): string[] {
  const rank = (n: CanvasNode) => {
    if (running.has(n.ref)) return 0;
    if (waiting.has(n.ref)) return 1;
    return sessionAlert(false, stats[n.ref]) ? 2 : 3;
  };
  return [...nodes].sort((a, b) => rank(a) - rank(b) || b.mtime - a.mtime).slice(0, max).map((n) => n.id);
}
