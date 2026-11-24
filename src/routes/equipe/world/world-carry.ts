import type { Point } from './world-map';

export interface CarryPlan { go: Point[]; adjacent: Point }

const cheb = (a: Point, b: Point): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const RING: readonly (readonly [number, number])[] = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
export const MAX_CARRY_STEPS = 60;

// The free tile beside the receiver that is closest to the sender.
export function approachTile(target: Point, from: Point, free: (p: Point) => boolean): Point | null {
  const cands = RING.map(([dx, dy]) => ({ x: target.x + dx!, y: target.y + dy! })).filter(free);
  if (cands.length === 0) return null;
  return cands.sort((a, b) => cheb(a, from) - cheb(b, from) || Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0]!;
}

// null = cannot be walked (unreachable or too far): the caller falls back to the flying item.
export function planCarry(sender: Point, receiver: Point, free: (p: Point) => boolean, route: (a: Point, b: Point) => Point[], maxSteps = MAX_CARRY_STEPS): CarryPlan | null {
  if (cheb(sender, receiver) <= 1) return { go: [], adjacent: sender };
  const adjacent = approachTile(receiver, sender, free);
  if (!adjacent) return null;
  const go = route(sender, adjacent);
  const end = go[go.length - 1];
  if (!end || end.x !== adjacent.x || end.y !== adjacent.y || go.length > maxSteps) return null;
  return { go, adjacent };
}
