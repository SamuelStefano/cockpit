import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AreaId, CanvasFlow, CanvasNode, OrchestratorInfo } from '../../../shared/canvas';
import { hasPref, usePersisted } from '../../lib/persist';
import {
  buildChainTree, estimateAreaHeight, hasLiveSession, layoutChainTree, type ChainPos,
} from './chain-layout';

const NARROW_QUERY = '(max-width: 640px)';
const COLLAPSE_PREF_KEY = 'canvas.chainCollapsedAreas';
// Rough allowance for the header + CanvasFilters + tab row + page padding
// above the chain canvas — good enough for a "would this column overflow the
// screen" decision, not meant to be pixel-exact.
const CHROME_H = 260;

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
// never a diagonal. Every root->area connector shares the same midY (both
// ends sit on the same two rows), so together they read as one horizontal
// bus line rather than N separate elbows.
function elbowPath(px: number, py: number, cx: number, cy: number): string {
  const midY = (py + cy) / 2;
  return `M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`;
}

export function useCanvasChain(nodes: CanvasNode[], flows: CanvasFlow[], running: Set<string>, orchestrator: OrchestratorInfo | undefined) {
  const narrow = useNarrowViewport();
  // Only the area-level collapse persists (spec: "areas collapsed state
  // persisted in localStorage") — a session-level collapse is per-visit,
  // plain state, since the tree it's collapsing changes shape constantly.
  const [collapsedAreaList, setCollapsedAreaList] = usePersisted<AreaId[]>(COLLAPSE_PREF_KEY, []);
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

  // Point 4's default, applied ONCE: a device that never touched this pref
  // (hasPref false — an empty persisted list is indistinguishable from "user
  // expanded everything on purpose", so this only fires before the very
  // first explicit toggle) starts idle, tall areas collapsed and everything
  // else expanded. Any later toggle is a real user choice and persists as
  // normal from then on.
  useEffect(() => {
    if (hasPref(COLLAPSE_PREF_KEY) || tree.children.length === 0) return;
    const viewportH = typeof window === 'undefined' ? 900 : window.innerHeight - CHROME_H;
    const defaults = tree.children
      .filter((a) => a.kind === 'area' && a.areaId && !hasLiveSession(a, running) && estimateAreaHeight(a) > viewportH)
      .map((a) => a.areaId!);
    if (defaults.length) setCollapsedAreaList(defaults);
    // Runs once per fresh tree shape, not on every running-set tick — a
    // session starting/stopping mid-session must never yank an area open or
    // shut that the user (or this one-time default) already settled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

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
      const px = parent.x + parent.width / 2;
      const py = parent.y + parent.height;
      const cx = p.x + p.width / 2;
      const cy = p.y;
      out.push({ id: `${p.parentId}>${p.id}`, d: elbowPath(px, py, cx, cy) });
    }
    return out;
  }, [positions, byId]);

  return {
    narrow, tree, positions, edges, width, height,
    collapsedAreas, collapsedSessions, toggleArea, toggleSession,
  };
}

export type { ChainPos };
