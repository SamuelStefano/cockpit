import { memo } from 'react';
import type { CanvasEdge, CanvasEdgeKind, CanvasPos } from '../../../shared/canvas';
import { NODE_H, NODE_W } from './canvas-layout';

interface Props {
  edges: CanvasEdge[];
  pos: Record<string, CanvasPos>;
  focus: Set<string>;
}

const STYLE: Record<CanvasEdgeKind, { stroke: string; dash?: string; width: number }> = {
  write: { stroke: 'rgba(251,146,60,0.55)', width: 1.6 },
  read: { stroke: 'rgba(163,163,163,0.35)', dash: '6 6', width: 1.2 },
  link: { stroke: 'rgba(115,115,115,0.35)', dash: '2 6', width: 1 },
  card: { stroke: 'rgba(251,146,60,0.8)', dash: '8 5', width: 1.8 },
  // Inferred, not observed (no tool call proves it) — short dash, dim, and its
  // own opacity scales with match weight so a strong guess reads darker than a
  // weak one even before the node is focused.
  topic: { stroke: 'rgba(94,234,212,0.45)', dash: '1 4', width: 1 },
};

function path(a: CanvasPos, b: CanvasPos): string {
  const ax = a.x + NODE_W / 2; const ay = a.y + NODE_H / 2;
  const bx = b.x + NODE_W / 2; const by = b.y + NODE_H / 2;
  const mx = (ax + bx) / 2;
  return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
}

export const CanvasEdges = memo(function CanvasEdges({ edges, pos, focus }: Props) {
  const hasFocus = focus.size > 0;
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
      {edges.map((e) => {
        const a = pos[e.source]; const b = pos[e.target];
        if (!a || !b) return null;
        const s = STYLE[e.kind];
        const on = focus.has(e.source) || focus.has(e.target);
        const weightOpacity = e.kind === 'topic' ? 0.4 + 0.6 * (e.weight ?? 1) : 1;
        return (
          <path
            key={`${e.source}>${e.target}`} d={path(a, b)} fill="none"
            stroke={s.stroke} strokeWidth={on ? s.width * 1.8 : s.width} strokeDasharray={s.dash}
            opacity={(hasFocus && !on ? 0.15 : 1) * weightOpacity}
          />
        );
      })}
    </svg>
  );
});
