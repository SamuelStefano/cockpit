import { memo, useEffect, useState } from 'react';
import type { CanvasFlow, CanvasNode, CanvasPos } from '../../../shared/canvas';
import { NODE_H, NODE_W } from './canvas-layout';
import { TERM_H, TERM_W } from './canvas-terms';
import type { PortDrag } from './useFlowPorts';

interface Props {
  nodes: CanvasNode[];
  pos: Record<string, CanvasPos>;
  windows: Set<string>;
  flows: CanvasFlow[];
  firedAt: Record<string, number>;
  portDrag: PortDrag | null;
  onPortDown: (e: React.PointerEvent, id: string) => void;
  onFlowClick: (id: string) => void;
}

// How long an arrow keeps pulsing after its `canvas-flow-fired` broadcast.
const PULSE_MS = 2000;

function rect(p: CanvasPos, isWindow: boolean) {
  return { x: p.x, y: p.y, w: isWindow ? TERM_W : NODE_W, h: isWindow ? TERM_H : NODE_H };
}

// Output port sits on the right edge; a flow always arrives on the target's
// left edge, so the arrow reads as one continuous left-to-right pipeline.
const outAnchor = (p: CanvasPos, isWindow: boolean) => { const r = rect(p, isWindow); return { x: r.x + r.w, y: r.y + r.h / 2 }; };
const inAnchor = (p: CanvasPos, isWindow: boolean) => { const r = rect(p, isWindow); return { x: r.x, y: r.y + r.h / 2 }; };

function curve(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const mx = (a.x + b.x) / 2;
  return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
}

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

// Flows render on their own layer (not CanvasEdges): bold orange, an
// arrowhead, animated dashes flowing source→target, and — unlike a plain
// edge — they carry interactive ports (drag to draw a new flow) and open
// FlowEditor on click.
export const CanvasFlows = memo(function CanvasFlows({ nodes, pos, windows, flows, firedAt, portDrag, onPortDown, onFlowClick }: Props) {
  const now = Date.now();
  usePulseTick(flows.some((f) => firedAt[f.id] && now - firedAt[f.id] < PULSE_MS));

  const ports = nodes.filter((n) => n.kind === 'session' || n.kind === 'card');

  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
      <defs>
        <marker id="deck-flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="rgba(251,146,60,0.9)" />
        </marker>
      </defs>
      <style>{'@keyframes deck-flow-dash{to{stroke-dashoffset:-32px}}.deck-flow-line{animation:deck-flow-dash 0.8s linear infinite}'}</style>
      {flows.map((f) => {
        const a = pos[f.from]; const b = pos[f.to];
        if (!a || !b) return null;
        const from = outAnchor(a, windows.has(f.from));
        const to = inAnchor(b, windows.has(f.to));
        const fired = firedAt[f.id];
        const pulsing = !!fired && now - fired < PULSE_MS;
        const d = curve(from, to);
        return (
          <g key={f.id} className="pointer-events-auto cursor-pointer" onClick={() => onFlowClick(f.id)}>
            <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
            <path
              d={d} fill="none" markerEnd="url(#deck-flow-arrow)" strokeDasharray="10 6"
              stroke={f.enabled ? 'rgba(251,146,60,0.85)' : 'rgba(115,115,115,0.45)'}
              strokeWidth={pulsing ? 3.2 : 2}
              className={f.enabled ? 'deck-flow-line' : undefined}
              style={pulsing ? { filter: 'drop-shadow(0 0 5px rgba(251,146,60,0.85))' } : undefined}
            />
            {f.fires > 0 && (
              <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6} textAnchor="middle" fontSize={11} fill="rgba(251,146,60,0.9)">{f.fires}</text>
            )}
          </g>
        );
      })}
      {portDrag && pos[portDrag.from] && (
        <path
          d={curve(outAnchor(pos[portDrag.from], windows.has(portDrag.from)), portDrag)}
          fill="none" stroke="rgba(251,146,60,0.6)" strokeWidth={2} strokeDasharray="4 4"
        />
      )}
      {ports.map((n) => {
        const at = pos[n.id];
        if (!at) return null;
        const anchor = outAnchor(at, windows.has(n.id));
        return (
          <circle
            key={`port-${n.id}`} cx={anchor.x} cy={anchor.y} r={7}
            className="pointer-events-auto cursor-crosshair fill-orange-500/80 stroke-2 stroke-neutral-950 hover:fill-orange-400"
            onPointerDown={(e) => onPortDown(e, n.id)}
          >
            <title>arraste pra outra sessão/card pra encadear</title>
          </circle>
        );
      })}
    </svg>
  );
});
