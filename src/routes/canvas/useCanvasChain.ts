import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AreaId, CanvasFlow, CanvasNode, OrchestratorInfo } from '../../../shared/canvas';
import { usePersisted } from '../../lib/persist';
import {
  buildChainTree, layoutChainTree, CHAIN_COL_W, CHAIN_NODE_H, CHAIN_NODE_W, CHAIN_ROW_H, type ChainPos,
} from './chain-layout';

const NARROW_QUERY = '(max-width: 640px)';

function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return narrow;
}

export interface ChainEdgeLine { id: string; d: string }

// Elbow connector: down from the parent's bottom-center, across at the row's
// midline, down into the child's top-center — the standard org-chart shape,
// never a diagonal.
function elbowPath(px: number, py: number, cx: number, cy: number): string {
  const midY = (py + cy) / 2;
  return `M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`;
}

export function useCanvasChain(nodes: CanvasNode[], flows: CanvasFlow[], running: Set<string>, orchestrator: OrchestratorInfo | undefined) {
  const narrow = useNarrowViewport();
  // Only the area-level collapse persists (spec: "areas collapsed state
  // persisted in localStorage") — a session-level collapse is per-visit,
  // plain state, since the tree it's collapsing changes shape constantly.
  const [collapsedAreaList, setCollapsedAreaList] = usePersisted<AreaId[]>('canvas.chainCollapsedAreas', []);
  const collapsedAreas = useMemo(() => new Set(collapsedAreaList), [collapsedAreaList]);
  const [collapsedSessions, setCollapsedSessions] = useState<Set<string>>(new Set());

  const toggleArea = useCallback((area: AreaId) => {
    setCollapsedAreaList((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }, [setCollapsedAreaList]);
  const toggleSession = useCallback((id: string) => {
    setCollapsedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const tree = useMemo(() => buildChainTree(nodes, flows, running, orchestrator), [nodes, flows, running, orchestrator]);
  const { positions, width, height } = useMemo(
    () => layoutChainTree(tree, { collapsedAreas, collapsedSessions }),
    [tree, collapsedAreas, collapsedSessions],
  );

  const byId = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
  const edges = useMemo<ChainEdgeLine[]>(() => {
    const out: ChainEdgeLine[] = [];
    for (const p of positions) {
      if (!p.parentId) continue;
      const parent = byId.get(p.parentId);
      if (!parent) continue;
      const px = parent.x + CHAIN_NODE_W / 2;
      const py = parent.y + CHAIN_NODE_H;
      const cx = p.x + CHAIN_NODE_W / 2;
      const cy = p.y;
      out.push({ id: `${p.parentId}>${p.id}`, d: elbowPath(px, py, cx, cy) });
    }
    return out;
  }, [positions, byId]);

  return {
    narrow, tree, positions, edges,
    width: Math.max(width, CHAIN_COL_W), height: Math.max(height, CHAIN_ROW_H),
    collapsedAreas, collapsedSessions, toggleArea, toggleSession,
  };
}

export type { ChainPos };
