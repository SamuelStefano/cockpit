import { AREA_LABELS, type AreaId, type CanvasNode, type CanvasPos } from '../../../shared/canvas';
import { NODE_H, NODE_W } from './canvas-layout';
import { TERM_H, TERM_W } from './canvas-terms';

// One soft rectangle per area, sized to the bounding box of its member nodes
// (plus padding) — pure geometry so it's testable without mounting anything,
// and recomputed every render from the current `pos` map so it tracks a drag.

export interface AreaRect {
  area: AreaId;
  label: string;
  x: number; y: number; w: number; h: number;
  sessions: number;
  running: number;
  terminals: number;
}

const PAD = 56;
// Below this many members, trimming would just pick an arbitrary node as the
// new edge (there's no real "outlier" concept in a cluster of 2-4) — plain
// min/max is both simpler and more honest there.
const TRIM_MIN_MEMBERS = 5;
const TRIM_FRACTION = 0.1;

// A dragged node stretching an area's rectangle across the whole map is the
// worse failure mode (it stops reading as "a region", not just as "a big
// region") than the rectangle occasionally not quite reaching one far outlier.
// Order-statistic trim (10th/90th by count, not interpolated) rather than a
// true percentile — cheap, deterministic, and good enough for a decorative
// bounding box.
function trimmedExtent(values: number[], pick: (sorted: number[]) => number): number {
  if (values.length < TRIM_MIN_MEMBERS) return pick(values);
  const sorted = [...values].sort((a, b) => a - b);
  // At least 1 once trimming applies at all — 10% of a realistic area (5-30
  // members) would otherwise round down to 0 and never actually trim anything.
  const cut = Math.max(1, Math.floor(sorted.length * TRIM_FRACTION));
  return pick(sorted.slice(cut, sorted.length - cut));
}

export function computeAreaRects(
  nodes: CanvasNode[], pos: Record<string, CanvasPos>, running: Set<string>, windows: Set<string>,
): AreaRect[] {
  const byArea = new Map<AreaId, CanvasNode[]>();
  for (const n of nodes) {
    if (!n.area || !pos[n.id]) continue;
    let members = byArea.get(n.area);
    if (!members) { members = []; byArea.set(n.area, members); }
    members.push(n);
  }

  // An open window renders at TERM_W×TERM_H, not the small node-card footprint
  // — same distinction useCanvasRoute's `rectOf` and canvas-layout's `bounds`
  // already make, so the region actually contains the terminal, not just its
  // top-left corner.
  const sizeOf = (n: CanvasNode) => (windows.has(n.id) ? { w: TERM_W, h: TERM_H } : { w: NODE_W, h: NODE_H });

  const out: AreaRect[] = [];
  for (const [area, members] of byArea) {
    const lefts = members.map((n) => pos[n.id].x);
    const tops = members.map((n) => pos[n.id].y);
    const rights = members.map((n) => pos[n.id].x + sizeOf(n).w);
    const bottoms = members.map((n) => pos[n.id].y + sizeOf(n).h);
    const x = trimmedExtent(lefts, (s) => s[0]) - PAD;
    const y = trimmedExtent(tops, (s) => s[0]) - PAD;
    const right = trimmedExtent(rights, (s) => s[s.length - 1]) + PAD;
    const bottom = trimmedExtent(bottoms, (s) => s[s.length - 1]) + PAD;
    out.push({
      area, label: AREA_LABELS[area], x, y, w: right - x, h: bottom - y,
      sessions: members.filter((n) => n.kind === 'session').length,
      running: members.filter((n) => n.kind === 'session' && running.has(n.ref)).length,
      terminals: members.filter((n) => windows.has(n.id)).length,
    });
  }
  return out.sort((a, b) => a.area.localeCompare(b.area));
}
