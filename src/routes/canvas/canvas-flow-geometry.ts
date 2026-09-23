import type { CanvasPos } from '../../../shared/canvas';
import { COMPACT_NODE_H, NODE_H, NODE_W } from './canvas-layout';
import { TERM_H, TERM_W } from './canvas-terms';

// Shared by CanvasFlowArrows.tsx (arrows, below nodes) and CanvasFlowPorts.tsx
// (ports + rubber band, above nodes) — same node rect either layer needs to
// anchor to, split out so the two stay pixel-identical without copy-paste.

export function flowNodeRect(p: CanvasPos, isWindow: boolean, compact: boolean): { x: number; y: number; w: number; h: number } {
  if (isWindow) return { x: p.x, y: p.y, w: TERM_W, h: TERM_H };
  return { x: p.x, y: p.y, w: NODE_W, h: compact ? COMPACT_NODE_H : NODE_H };
}

// Output port sits on the right edge; a flow always arrives on the target's
// left edge, so the arrow reads as one continuous left-to-right pipeline.
export function flowOutAnchor(p: CanvasPos, isWindow: boolean, compact: boolean): CanvasPos {
  const r = flowNodeRect(p, isWindow, compact);
  return { x: r.x + r.w, y: r.y + r.h / 2 };
}

export function flowInAnchor(p: CanvasPos, isWindow: boolean, compact: boolean): CanvasPos {
  const r = flowNodeRect(p, isWindow, compact);
  return { x: r.x, y: r.y + r.h / 2 };
}

export function flowCurve(a: CanvasPos, b: CanvasPos): string {
  const mx = (a.x + b.x) / 2;
  return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
}
