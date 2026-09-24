import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AreaId, CanvasEdge, CanvasFlow, CanvasNode, CanvasPos, OrchestratorInfo, TermStats } from '../../../shared/canvas';
import type { BudgetStatus } from '../../../shared/canvas-budget';
import { CanvasAreas } from './CanvasAreas';
import type { AreaRect } from './canvas-areas';
import { CanvasEdges } from './CanvasEdges';
import { CanvasFlowArrows } from './CanvasFlowArrows';
import { CanvasFlowPorts } from './CanvasFlowPorts';
import { CanvasNodeCard } from './CanvasNodeCard';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasWindows } from './CanvasWindows';
import type { TermApi } from '../../useCockpit';
import type { CanvasTerms } from './useCanvasTerms';
import { TERM_H, TERM_W } from './canvas-terms';
import { neighbors } from './canvas-filter';
import { isOrchestratorNode } from './orchestrator';
import { useCanvasViewport } from './useCanvasViewport';
import { useFlowPorts } from './useFlowPorts';
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
  windows: Set<string>;
  terms: CanvasTerms;
  term: TermApi;
  onOpenChat: (sessionId: string) => void;
  onOpenRecent: () => void;
  onOpenTerm: (id: string) => void;
  onSendTo: (sessionId: string, text: string) => boolean;
  sendError: { sessionId: string; text: string; message: string } | null;
  onDismissSendError: () => void;
  stats: Record<string, TermStats>;
  analysisOn: boolean;
  onToggleAnalysis: () => void;
  flows: CanvasFlow[];
  flowFired: Record<string, number>;
  onFlowCreate: (from: string, to: string) => void;
  onFlowClick: (id: string) => void;
  areaRects: AreaRect[];
  budgetStatus: Partial<Record<AreaId, BudgetStatus>>;
  onEditBudget: (area: AreaId) => void;
  // Timeline scrub state: `null` while live (nothing extra dimmed). Scrubbed
  // to the past, `pastAlive` lists which node ids were alive at that instant
  // — everything else fades, and every terminal window gets an overlay.
  pastAlive: Set<string> | null;
  // Timeline is animating through many time steps a second: CSS opacity
  // transitions re-triggering on every node, every tick, is real jank.
  timelinePlaying: boolean;
  orchestrator: OrchestratorInfo | undefined;
  onFocusOrchestrator?: () => void;
  dockOpen?: boolean;
  onToggleDock?: () => void;
  children?: React.ReactNode;
}

const COMPACT_BELOW = 0.42;
// Floor for the very first framing only — legible enough to read a title
// without a manual zoom-in; "fit all" (toolbar) stays unfloored on purpose.
// 50%: below that a TERM_W×TERM_H terminal window (640×400) renders under
// 320×200 screen px — code inside reads as a grey smear, not text (#598 map
// cleanup). The map is still pannable past this box, so nothing is lost.
const INITIAL_MIN_ZOOM = 0.5;

export function CanvasSurface(p: Props) {
  const vp = useCanvasViewport();
  const { live, onNodeDown, onNodeMove, onNodeUp } = useNodeDrag(vp.viewRef, p.pos, p.onDrop, p.onSelect);
  const pos = useMemo(() => ({ ...p.pos, ...live }), [p.pos, live]);

  // A flow can only land on a session or a card — never a context/shell, which
  // server/canvas/flows.ts has no way to deliver a prompt to.
  const nodeKindOf = useMemo(() => new Map(p.nodes.map((n) => [n.id, n.kind])), [p.nodes]);
  const canDropFlow = useCallback((id: string) => nodeKindOf.get(id) === 'session' || nodeKindOf.get(id) === 'card', [nodeKindOf]);
  const { portDrag, onPortDown, onPortMove, onPortUp, onPortLostCapture } = useFlowPorts(vp.viewRef, vp.ref, canDropFlow, p.onFlowCreate);

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
  const windowsRef = useRef(p.windows);
  windowsRef.current = p.windows;

  // "Open recent" drops a batch of windows into the lane, usually off-screen:
  // frame them once the new bounds land instead of leaving the user to hunt.
  const fitNext = useRef(false);
  // Nothing new to open (or nothing to move) leaves the bounds as they were;
  // don't let the armed fit fire later on an unrelated auto-open.
  const armFit = () => {
    fitNext.current = true;
    setTimeout(() => { fitNext.current = false; }, 1000);
  };
  useEffect(() => {
    if (!fitNext.current) return;
    fitNext.current = false;
    fit(p.initialBounds, INITIAL_MIN_ZOOM);
  }, [p.initialBounds, fit]);
  const req = p.centerRequest;
  const centeredN = useRef<number | null>(null);
  useEffect(() => {
    if (!req || centeredN.current === req.n) return;
    const target = posRef.current[req.id];
    if (!target) return;
    centeredN.current = req.n;
    if (windowsRef.current.has(req.id)) centerOn(target, TERM_W, TERM_H);
    else centerOn(target);
  }, [req, centerOn]);

  const focus = useMemo(() => {
    const out = new Set(p.selected);
    for (const id of p.selected) for (const nb of neighbors(p.edges, id)) out.add(nb);
    return out;
  }, [p.selected, p.edges]);
  const selectedSet = useMemo(() => new Set(p.selected), [p.selected]);

  const cards = useMemo(() => p.nodes.filter((n) => !p.windows.has(n.id)), [p.nodes, p.windows]);
  const wins = useMemo(() => p.nodes.filter((n) => p.windows.has(n.id)), [p.nodes, p.windows]);

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
      // Middle button pans from anywhere — over a card or a live terminal too —
      // so moving around never risks a left-click landing on something.
      onPointerDownCapture={(e) => {
        if (e.button !== 1 || (e.target instanceof Element && e.target.closest('[data-canvas-overlay]'))) return;
        e.preventDefault();
        e.stopPropagation();
        vp.onBackgroundDown(e);
      }}
      // Kills the browser's autoscroll and the X11 middle-click paste into xterm.
      onMouseDownCapture={(e) => { if (e.button === 1) e.preventDefault(); }}
      onMouseUpCapture={(e) => { if (e.button === 1) e.preventDefault(); }}
      onAuxClickCapture={(e) => { if (e.button === 1) e.preventDefault(); }}
      onPointerDown={(e) => {
        // Overlays (toolbar, inspector, roster) sit inside the surface: capturing
        // their press for a pan would swallow the click on their buttons.
        if (e.target !== e.currentTarget) return;
        p.onClear();
        vp.onBackgroundDown(e);
      }}
      onPointerMove={(e) => { onNodeMove(e); onPortMove(e); vp.onBackgroundMove(e); }}
      onPointerUp={(e) => { onNodeUp(); onPortUp(e); vp.onBackgroundUp(e); }}
      onPointerCancel={(e) => { onNodeUp(); onPortUp(e); vp.onBackgroundUp(e); }}
    >
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <CanvasAreas rects={p.areaRects} status={p.budgetStatus} onEditBudget={p.onEditBudget} past={p.pastAlive !== null} />
        <CanvasEdges edges={p.edges} pos={pos} focus={focus} past={p.pastAlive !== null} />
        {/* Arrows paint BELOW the nodes — pointer-events-none except a small
            midpoint chip, never a wide hit-band over the whole route, so a
            card or a live terminal an arrow happens to cross stays fully
            clickable/draggable underneath it. */}
        <CanvasFlowArrows
          nodes={p.nodes} pos={pos} windows={p.windows} compact={compact} flows={p.flows} firedAt={p.flowFired}
          onFlowClick={p.onFlowClick} past={p.pastAlive !== null}
        />
        {cards.map((n) => pos[n.id] && (
          <CanvasNodeCard
            key={n.id} node={n} pos={pos[n.id]} compact={compact} zoom={view.k}
            selected={selectedSet.has(n.id)} dim={(focus.size > 0 && !focus.has(n.id)) || (p.pastAlive !== null && !p.pastAlive.has(n.id))}
            running={n.kind === 'session' && p.running.has(n.ref)} waiting={n.kind === 'session' && p.waiting.has(n.ref)}
            orchestrator={isOrchestratorNode(n, p.orchestrator)}
            stats={p.stats[n.ref]} instant={p.timelinePlaying}
            onPointerDown={onNodeDown} onOpenTerm={p.onOpenTerm}
          />
        ))}
        <CanvasWindows
          nodes={wins} pos={pos} terms={p.terms} term={p.term} selected={selectedSet} focus={focus}
          running={p.running} waiting={p.waiting} orchestrator={p.orchestrator}
          onPointerDown={onNodeDown} onOpenChat={p.onOpenChat} onSendTo={p.onSendTo} onDock={p.onToggleDock}
          sendError={p.sendError} onDismissSendError={p.onDismissSendError} stats={p.stats}
          past={p.pastAlive !== null} pastAlive={p.pastAlive} instant={p.timelinePlaying}
        />
        {/* Ports paint LAST, on top of everything — a port must never sit
            under a card's edge, or it can't be grabbed to start a drag. */}
        <CanvasFlowPorts
          nodes={p.nodes} pos={pos} windows={p.windows} compact={compact} zoom={view.k}
          portDrag={portDrag} onPortDown={onPortDown} onPortLostCapture={onPortLostCapture}
        />
      </div>
      {p.children}
      <CanvasToolbar
        zoom={view.k} onZoom={vp.zoomBy} onFit={() => fit(p.bounds)} onNewTerminal={p.terms.newShell}
        onResetLayout={() => { armFit(); p.onResetLayout(); }}
        onOpenRecent={() => { armFit(); p.onOpenRecent(); }}
        analysisOn={p.analysisOn} onToggleAnalysis={p.onToggleAnalysis}
        onFocusOrchestrator={p.onFocusOrchestrator} dockOpen={p.dockOpen} onToggleDock={p.onToggleDock}
      />
    </div>
  );
}
