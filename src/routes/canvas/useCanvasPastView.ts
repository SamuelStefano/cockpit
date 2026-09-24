import { useMemo } from 'react';
import type { CanvasEdge, CanvasNode, CanvasPos } from '../../../shared/canvas';
import { bounds, layoutCanvas } from './canvas-layout';
import { pastAliveIds, pastExecIds } from './canvas-timeline';
import { placeWindows } from './canvas-terms';
import { useTimeline, type Timeline } from './useTimeline';
import type { CanvasRoute, CanvasRouteProps } from './useCanvasRoute';

export interface CanvasPastView {
  timeline: Timeline;
  pastNodes: CanvasNode[];
  pastEdges: CanvasEdge[];
  pastPos: Record<string, CanvasPos>;
  pastBounds: { x: number; y: number; w: number; h: number };
  pastAlive: Set<string> | null;
}

// Pure extraction of Canvas.tsx's old inline timeline/past-view block (no
// behaviour change) — the file was 347 lines against CLAUDE.md's ~150 cap.
//
// Exec scope seeds off "alive right NOW" (canvas-filter.ts) — scrubbing the
// timeline back doesn't reseed it, so a session alive at T but idle right now
// was never in r.visible to begin with, dimmed or not. While the timeline
// isn't live AND the scope is exec, rebuild the node/edge set from "alive at
// T" instead (pastExecIds, over the FULL graph — r.merged — not the
// already-narrowed r.visible; same automation/archived filters the live exec
// scope already applies), falling back to the normal exec set the moment
// "agora" brings the timeline back live.
export function useCanvasPastView(r: CanvasRoute, p: CanvasRouteProps, dockedNodeId: string | null): CanvasPastView {
  const timeline = useTimeline();
  const pastExecNodeIds = useMemo(
    () => (r.scope === 'exec' && !timeline.live
      ? pastExecIds(r.merged.nodes, r.merged.edges, timeline.t, p.runStart, { showAutomation: r.showAutomation, archived: r.archived, running: p.running })
      : null),
    [r.scope, timeline.live, timeline.t, r.merged.nodes, r.merged.edges, p.runStart, r.showAutomation, r.archived, p.running],
  );
  const pastNodesUnfiltered = useMemo(
    () => (pastExecNodeIds ? r.merged.nodes.filter((n) => pastExecNodeIds.has(n.id)) : r.visible.nodes),
    [pastExecNodeIds, r.merged.nodes, r.visible.nodes],
  );
  const pastEdgesUnfiltered = useMemo(
    () => (pastExecNodeIds ? r.merged.edges.filter((e) => pastExecNodeIds.has(e.source) && pastExecNodeIds.has(e.target)) : r.visible.edges),
    [pastExecNodeIds, r.merged.edges, r.visible.edges],
  );
  // Docked: the orchestrator's node is dropped from the map entirely (not just
  // from the window set) — it lives in the sidebar now, so it must not also
  // show up as a plain card. Edges pointing at it would otherwise dangle.
  const pastNodes = useMemo(
    () => (dockedNodeId ? pastNodesUnfiltered.filter((n) => n.id !== dockedNodeId) : pastNodesUnfiltered),
    [dockedNodeId, pastNodesUnfiltered],
  );
  const pastEdges = useMemo(
    () => (dockedNodeId ? pastEdgesUnfiltered.filter((e) => e.source !== dockedNodeId && e.target !== dockedNodeId) : pastEdgesUnfiltered),
    [dockedNodeId, pastEdgesUnfiltered],
  );
  const pastWindows = useMemo(
    () => (pastExecNodeIds ? [...r.windows].filter((id) => pastExecNodeIds.has(id)) : [...r.windows]),
    [pastExecNodeIds, r.windows],
  );
  // Laid out ONCE over the WHOLE merged graph, independent of the scrub
  // position — a full layoutCanvas repack every playback tick (200ms) or
  // scrub both wasted CPU and made a node's spot jump around as the alive-at-T
  // set changed under it. Only WHICH ids are shown changes per tick now;
  // where they'd sit if shown never does. Gated on `pastViewActive` (a stable
  // boolean, unlike pastExecNodeIds' own Set which is a fresh reference every
  // tick) so it's null — and layoutCanvas never runs — for the normal, far
  // more common live view: a board.pos change from a plain drag would
  // otherwise rerun this on EVERY drag frame even with the past view off.
  const pastViewActive = r.scope === 'exec' && !timeline.live;
  const pastLayoutPos = useMemo(
    () => (pastViewActive ? layoutCanvas(r.merged.nodes, r.merged.edges, p.board.pos) : null),
    [pastViewActive, r.merged, p.board.pos],
  );
  const pastPos = useMemo(() => {
    if (!pastExecNodeIds || !pastLayoutPos) return r.pos;
    const picked: typeof pastLayoutPos = {};
    for (const id of pastExecNodeIds) if (pastLayoutPos[id]) picked[id] = pastLayoutPos[id];
    return placeWindows(picked, p.board.pos, pastWindows);
  }, [pastExecNodeIds, pastLayoutPos, p.board.pos, pastWindows, r.pos]);
  const pastBounds = useMemo(
    () => (pastExecNodeIds ? bounds(Object.values(pastPos)) : r.worldBounds),
    [pastExecNodeIds, pastPos, r.worldBounds],
  );
  // null while live means "nothing extra to dim".
  const pastAlive = useMemo(
    () => (timeline.live ? null : pastAliveIds(pastNodes, pastEdges, timeline.t, p.runStart)),
    [timeline.live, timeline.t, pastNodes, pastEdges, p.runStart],
  );

  return { timeline, pastNodes, pastEdges, pastPos, pastBounds, pastAlive };
}
