import { useEffect, useMemo, useRef } from 'react';
import type { CanvasEdge, CanvasNode, CanvasPos } from '../../../shared/canvas';
import { CanvasEdges } from './CanvasEdges';
import { CanvasNodeCard } from './CanvasNodeCard';
import { CanvasToolbar } from './CanvasToolbar';
import { neighbors } from './canvas-filter';
import { useCanvasViewport } from './useCanvasViewport';
import { useNodeDrag } from './useNodeDrag';

interface Props {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  pos: Record<string, CanvasPos>;
  bounds: { x: number; y: number; w: number; h: number };
  initialBounds: { x: number; y: number; w: number; h: number };
  selected: string[];
  running: Set<string>;
  waiting: Set<string>;
  centerRequest: { id: string; n: number } | null;
  onSelect: (id: string, additive: boolean) => void;
  onClear: () => void;
  onDrop: (p: Record<string, CanvasPos>) => void;
  onResetLayout: () => void;
  children?: React.ReactNode;
}

const COMPACT_BELOW = 0.42;
// Floor for the very first framing only — legible enough to read a title
// without a manual zoom-in; "fit all" (toolbar) stays unfloored on purpose.
const INITIAL_MIN_ZOOM = 0.35;

export function CanvasSurface(p: Props) {
  const vp = useCanvasViewport();
  const { live, onNodeDown, onNodeMove, onNodeUp } = useNodeDrag(vp.viewRef, p.pos, p.onDrop, p.onSelect);
  const pos = useMemo(() => ({ ...p.pos, ...live }), [p.pos, live]);

  const fitted = useRef(false);
  const { fit, centerOn } = vp;
  useEffect(() => {
    if (fitted.current || !p.nodes.length) return;
    fitted.current = true;
    fit(p.initialBounds, INITIAL_MIN_ZOOM);
  }, [p.nodes.length, p.initialBounds, fit]);

  // `p.pos` gets a new identity on every layout recompute (any streamed token
  // from any running agent touches `running`, which feeds `visible`), so a
  // dep on it here re-centers on every frame — panning away or zooming out
  // was undone before the user's hand left the trackpad. Center once per
  // request (keyed on `req.n`) and read the current position through a ref.
  const posRef = useRef(p.pos);
  posRef.current = p.pos;
  const req = p.centerRequest;
  const centeredN = useRef<number | null>(null);
  useEffect(() => {
    if (!req || centeredN.current === req.n) return;
    const target = posRef.current[req.id];
    if (!target) return;
    centeredN.current = req.n;
    centerOn(target);
  }, [req, centerOn]);

  const focus = useMemo(() => {
    const out = new Set(p.selected);
    for (const id of p.selected) for (const nb of neighbors(p.edges, id)) out.add(nb);
    return out;
  }, [p.selected, p.edges]);
  const selectedSet = useMemo(() => new Set(p.selected), [p.selected]);

  const { view } = vp;
  const grid = 24 * view.k;
  const compact = view.k < COMPACT_BELOW;

  return (
    <div
      ref={vp.ref}
      className="relative min-h-0 flex-1 touch-none overflow-hidden bg-neutral-950"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(115,115,115,0.28) 1px, transparent 1.2px)',
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={(e) => {
        // Overlays (toolbar, inspector, roster) sit inside the surface: capturing
        // their press for a pan would swallow the click on their buttons.
        if (e.target !== e.currentTarget) return;
        p.onClear();
        vp.onBackgroundDown(e);
      }}
      onPointerMove={(e) => { onNodeMove(e); vp.onBackgroundMove(e); }}
      onPointerUp={(e) => { onNodeUp(); vp.onBackgroundUp(e); }}
      onPointerCancel={(e) => { onNodeUp(); vp.onBackgroundUp(e); }}
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <CanvasEdges edges={p.edges} pos={pos} focus={focus} />
        {p.nodes.map((n) => pos[n.id] && (
          <CanvasNodeCard
            key={n.id} node={n} pos={pos[n.id]} compact={compact} zoom={view.k}
            selected={selectedSet.has(n.id)} dim={focus.size > 0 && !focus.has(n.id)}
            running={n.kind === 'session' && p.running.has(n.ref)} waiting={n.kind === 'session' && p.waiting.has(n.ref)}
            onPointerDown={onNodeDown}
          />
        ))}
      </div>
      {p.children}
      <CanvasToolbar zoom={view.k} onZoom={vp.zoomBy} onFit={() => fit(p.bounds)} onResetLayout={p.onResetLayout} />
    </div>
  );
}
