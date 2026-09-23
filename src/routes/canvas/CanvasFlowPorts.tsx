import { memo, useMemo } from 'react';
import type { CanvasNode, CanvasPos } from '../../../shared/canvas';
import { flowCurve, flowOutAnchor } from './canvas-flow-geometry';
import type { PortDrag } from './useFlowPorts';

interface Props {
  nodes: CanvasNode[];
  pos: Record<string, CanvasPos>;
  windows: Set<string>;
  compact: boolean;
  zoom: number;
  portDrag: PortDrag | null;
  onPortDown: (e: React.PointerEvent, id: string) => void;
  onPortLostCapture: () => void;
}

// World-space port radius is scaled by 1/zoom so the ON-SCREEN size never
// drops below this floor — at low zoom a fixed world radius shrinks to an
// unclickable dot, and the drag target would vanish exactly when the map is
// busiest (many nodes, zoomed out to see them all).
const PORT_SCREEN_R = 7;
const PORT_MIN_R = 4;
const PORT_MAX_R = 12;

// Only the interactive ports + the live rubber band, painted ON TOP of the
// node cards/windows (CanvasSurface.tsx renders this layer last) so a port
// never sits under a card's edge and is always grabbable. CanvasFlowArrows.tsx
// owns the arrows themselves, painted BELOW the nodes with (almost) no
// pointer events — splitting the two fixed a regression where painting
// everything above the nodes stole clicks/drags from cards and live
// terminals (canvas review — flows batch 2, #2).
export const CanvasFlowPorts = memo(function CanvasFlowPorts({ nodes, pos, windows, compact, zoom, portDrag, onPortDown, onPortLostCapture }: Props) {
  const ports = useMemo(() => nodes.filter((n) => n.kind === 'session' || n.kind === 'card'), [nodes]);
  const portR = Math.min(PORT_MAX_R, Math.max(PORT_MIN_R, PORT_SCREEN_R / zoom));

  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
      {portDrag && pos[portDrag.from] && (
        <path
          d={flowCurve(flowOutAnchor(pos[portDrag.from], windows.has(portDrag.from), compact), portDrag)}
          fill="none" stroke="rgba(251,146,60,0.6)" strokeWidth={2} strokeDasharray="4 4"
        />
      )}
      {ports.map((n) => {
        const at = pos[n.id];
        if (!at) return null;
        const anchor = flowOutAnchor(at, windows.has(n.id), compact);
        return (
          <circle
            key={`port-${n.id}`} data-flow-port={n.id} cx={anchor.x} cy={anchor.y} r={portR}
            className="pointer-events-auto cursor-crosshair fill-orange-500/80 stroke-2 stroke-neutral-950 hover:fill-orange-400"
            onPointerDown={(e) => onPortDown(e, n.id)}
            onLostPointerCapture={onPortLostCapture}
          >
            <title>arraste pra outra sessão/card pra encadear</title>
          </circle>
        );
      })}
    </svg>
  );
});
