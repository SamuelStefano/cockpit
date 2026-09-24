import { memo, useEffect, useMemo, useState } from 'react';
import type { CanvasFlow, CanvasNode, CanvasPos } from '../../../shared/canvas';
import { flowCurve, flowInAnchor, flowOutAnchor } from './canvas-flow-geometry';

interface Props {
  nodes: CanvasNode[];
  pos: Record<string, CanvasPos>;
  windows: Set<string>;
  compact: boolean;
  flows: CanvasFlow[];
  firedAt: Record<string, number>;
  onFlowClick: (id: string) => void;
  // Timeline scrubbed away from live: an arrow is a LIVE pipeline, so it
  // dims along with everything else rather than reading as still wired up.
  past: boolean;
  // Canvas zoom: the chip is sized in canvas units, so zoomed out to 0.3 its 9px
  // radius became ~3px on screen, too small to see or tap. It counter-scales.
  zoom?: number;
}

// How long an arrow keeps pulsing after its `canvas-flow-fired` broadcast.
const PULSE_MS = 2000;
// The clickable "open editor" surface — a small chip at the arrow's midpoint,
// not the path itself. A 16px-wide invisible hit-band following the WHOLE
// route used to sit on top of every card/terminal the curve happened to
// cross underneath, stealing their clicks and drags (canvas review — flows
// batch 2, #2). This layer paints BELOW the nodes (see CanvasSurface.tsx) and
// stays pointer-events-none everywhere except this one small chip.
const CHIP_R = 9;
// Never smaller than CHIP_R on screen; never bigger than CHIP_R in canvas units
// (zoomed in, the chip keeps its canvas size like everything else).
export const chipScaleFor = (zoom: number): number => (zoom > 0 && zoom < 1 ? 1 / zoom : 1);

// Same factor CanvasEdges.tsx uses for a non-conflict edge in the past view —
// one shared "how dim is dim" across every layer of the canvas.
const PAST_DIM = 0.35;

// Re-renders on an interval only while at least one arrow is still inside its
// pulse window — idle the rest of the time, unlike a naive rAF loop.
function usePulseTick(active: boolean, ms = 180) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => bump((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
}

// The arrows themselves: bold orange, an arrowhead, animated dashes flowing
// source→target. Rendered BELOW the node cards/windows (CanvasSurface.tsx),
// with (almost) no pointer events of its own — see CanvasFlowPorts.tsx for
// the interactive ports, painted on a separate layer above the nodes.
export const CanvasFlowArrows = memo(function CanvasFlowArrows({ nodes, pos, windows, compact, flows, firedAt, onFlowClick, past, zoom = 1 }: Props) {
  const chipScale = chipScaleFor(zoom);
  const now = Date.now();
  usePulseTick(flows.some((f) => firedAt[f.id] && now - firedAt[f.id] < PULSE_MS));

  // A node hidden by the current filter (search query, scope) can still have
  // a saved position — never draw an arrow to/from one that isn't actually
  // on screen.
  const visibleIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);

  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
      <defs>
        <marker id="deck-flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="rgba(251,146,60,0.9)" />
        </marker>
      </defs>
      <style>{'@keyframes deck-flow-dash{to{stroke-dashoffset:-32px}}.deck-flow-line{animation:deck-flow-dash 0.8s linear infinite}'}</style>
      {flows.map((f) => {
        if (!visibleIds.has(f.from) || !visibleIds.has(f.to)) return null;
        const a = pos[f.from]; const b = pos[f.to];
        if (!a || !b) return null;
        const from = flowOutAnchor(a, windows.has(f.from), compact);
        const to = flowInAnchor(b, windows.has(f.to), compact);
        const fired = firedAt[f.id];
        const pulsing = !!fired && now - fired < PULSE_MS;
        const d = flowCurve(from, to);
        const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        return (
          <g key={f.id}>
            <path
              d={d} fill="none" markerEnd="url(#deck-flow-arrow)" strokeDasharray="10 6"
              stroke={f.enabled ? 'rgba(251,146,60,0.85)' : 'rgba(115,115,115,0.45)'}
              strokeWidth={pulsing ? 3.2 : 2}
              className={f.enabled ? 'deck-flow-line' : undefined}
              style={pulsing ? { filter: 'drop-shadow(0 0 5px rgba(251,146,60,0.85))' } : undefined}
              opacity={past ? PAST_DIM : 1}
            />
            <g className="pointer-events-auto cursor-pointer" onClick={() => onFlowClick(f.id)} opacity={past ? PAST_DIM : 1}
              transform={chipScale === 1 ? undefined : `translate(${mid.x} ${mid.y}) scale(${chipScale}) translate(${-mid.x} ${-mid.y})`}>
              <circle cx={mid.x} cy={mid.y} r={CHIP_R} fill="rgba(23,23,23,0.9)" stroke={f.enabled ? 'rgba(251,146,60,0.85)' : 'rgba(115,115,115,0.6)'} strokeWidth={1.5} />
              <text x={mid.x} y={mid.y + 3.5} textAnchor="middle" fontSize={10} fill={f.enabled ? 'rgba(251,146,60,0.95)' : 'rgba(163,163,163,0.8)'}>{f.fires}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
});
