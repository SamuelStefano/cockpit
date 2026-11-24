export interface SwipePoint { x: number; y: number }

export const EDGE_ZONE = 24;
const MIN_DX = 56;
const MAX_SLOPE = 0.6;

function horizontal(a: SwipePoint, b: SwipePoint): number | null {
  const dx = b.x - a.x;
  const dy = Math.abs(b.y - a.y);
  if (Math.abs(dx) < MIN_DX || dy > Math.abs(dx) * MAX_SLOPE) return null;
  return dx;
}

export function isEdgeOpenSwipe(a: SwipePoint, b: SwipePoint): boolean {
  const dx = horizontal(a, b);
  return a.x <= EDGE_ZONE && dx !== null && dx > 0;
}

export function isCloseSwipe(a: SwipePoint, b: SwipePoint): boolean {
  const dx = horizontal(a, b);
  return dx !== null && dx < 0;
}
