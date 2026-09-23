import { memo } from 'react';
import type { CanvasEdge, CanvasEdgeKind, CanvasPos } from '../../../shared/canvas';
import { NODE_H, NODE_W } from './canvas-layout';

interface Props {
  edges: CanvasEdge[];
  pos: Record<string, CanvasPos>;
  focus: Set<string>;
  // Timeline scrubbed away from live: a 'conflict' edge is a LIVE warning —
  // showing it between two dimmed, no-longer-alive nodes reads as a current
  // problem that isn't one, so it's hidden outright rather than just dimmed.
  past: boolean;
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
  // A user-picked prompt INPUT, not an agent run — thinner and cooler than
  // `card` on purpose so it never reads as "this session is doing the work".
  input: { stroke: 'rgba(147,197,253,0.5)', dash: '4 4', width: 1.2 },
  // Two sessions about to step on the same file — red on purpose, never dimmed
  // by focus (see `on` below), so it reads as a warning even when unselected.
  conflict: { stroke: 'rgba(248,113,113,0.9)', dash: '5 3', width: 2 },
};

function basename(path: string): string {
  return path.split('/').pop() || path;
}

function path(a: CanvasPos, b: CanvasPos): string {
  const ax = a.x + NODE_W / 2; const ay = a.y + NODE_H / 2;
  const bx = b.x + NODE_W / 2; const by = b.y + NODE_H / 2;
  const mx = (ax + bx) / 2;
  return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
}

const PAST_DIM = 0.35;

export const CanvasEdges = memo(function CanvasEdges({ edges, pos, focus, past }: Props) {
  const hasFocus = focus.size > 0;
  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
      {edges.map((e) => {
        if (past && e.kind === 'conflict') return null; // a live warning, meaningless looking at history
        const a = pos[e.source]; const b = pos[e.target];
        if (!a || !b) return null;
        const s = STYLE[e.kind];
        const on = focus.has(e.source) || focus.has(e.target);
        const weightOpacity = e.kind === 'topic' ? 0.4 + 0.6 * (e.weight ?? 1) : 1;
        // A conflict is a warning regardless of what's currently focused — it
        // never fades into the background the way an unrelated edge does.
        const opacity = (e.kind === 'conflict' ? 1 : (hasFocus && !on ? 0.15 : 1) * weightOpacity) * (past ? PAST_DIM : 1);
        const mx = (a.x + b.x) / 2 + NODE_W / 2;
        const my = (a.y + b.y) / 2 + NODE_H / 2;
        return (
          <g key={`${e.source}>${e.target}`}>
            <path
              d={path(a, b)} fill="none"
              stroke={s.stroke} strokeWidth={on ? s.width * 1.8 : s.width} strokeDasharray={s.dash}
              opacity={opacity}
            />
            {e.kind === 'conflict' && e.files && e.files.length > 0 && (
              <g transform={`translate(${mx}, ${my})`}>
                <title>{e.files.join('\n')}</title>
                <text textAnchor="middle" dy={-4} fontSize={11} fill="rgb(248,113,113)">
                  {'⚠ ' + e.files.map(basename).join(', ')}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
});
