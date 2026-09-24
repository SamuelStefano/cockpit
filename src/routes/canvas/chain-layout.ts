import {
  AREA_IDS, sessionNodeId, type AreaId, type CanvasFlow, type CanvasNode, type OrchestratorInfo,
} from '../../../shared/canvas';
import { isOrchestratorNode } from './orchestrator';

// Org-chart tree for the canvas' "cadeia" view: Orchestrator at the top,
// areas below it, each area's root sessions below that, then each session's
// own children (fork / flow successor) recursively. Pure and layout-agnostic
// on purpose — CanvasChain.tsx only consumes the ChainPos[] this produces.

export type ChainItemKind = 'orchestrator' | 'area' | 'session';

export interface ChainItem {
  id: string; // 'orchestrator' | `area:${AreaId}` | the session's own node id (s:<uuid>)
  kind: ChainItemKind;
  node?: CanvasNode; // session kind only
  areaId?: AreaId; // area kind, and session kind (which area chip it inherits)
  children: ChainItem[];
}

// Same 3-tier "what's happening right now" ordering the exec scope already
// uses elsewhere on the canvas: running beats waiting-on-you beats everything
// else, then most-recently-touched first within a tier.
function tier(n: CanvasNode, running: Set<string>): number {
  if (running.has(n.ref)) return 0;
  if (n.waiting) return 1;
  return 2;
}

export function sortSessions(nodes: CanvasNode[], running: Set<string>): CanvasNode[] {
  return [...nodes].sort((a, b) => tier(a, running) - tier(b, running) || b.mtime - a.mtime || a.id.localeCompare(b.id));
}

// A flow only counts as a real successor once it has actually delivered at
// least once (fires > 0) — a drawn-but-never-fired flow arrow is a plan, not
// a chain-of-command link yet.
function flowParents(nodes: CanvasNode[], flows: CanvasFlow[]): Map<string, string> {
  const sessionIds = new Set(nodes.filter((n) => n.kind === 'session').map((n) => n.id));
  const out = new Map<string, string>();
  for (const f of flows) {
    if (!f.fires || !sessionIds.has(f.from) || !sessionIds.has(f.to)) continue;
    if (!out.has(f.to)) out.set(f.to, f.from);
  }
  return out;
}

export function buildChainTree(
  nodes: CanvasNode[], flows: CanvasFlow[], running: Set<string>, orchestrator?: OrchestratorInfo,
): ChainItem {
  const sessions = nodes.filter((n) => n.kind === 'session');
  const byId = new Map(sessions.map((n) => [n.id, n]));

  // The session node the orchestrator itself runs in (if it's in this node
  // set at all) becomes the root — it must never also show up a second time
  // under its own area.
  const orchestratorNode = orchestrator ? sessions.find((n) => isOrchestratorNode(n, orchestrator)) : undefined;
  const rootNodeId = orchestratorNode?.id;

  // Parent resolution, in priority order: an explicit fork parent (server/
  // canvas/fork-sessions.ts), then a fired flow's source, else none (hangs
  // under its area). Both are session node ids already, so no extra lookup.
  const flowParentOf = flowParents(nodes, flows);
  const parentOf = new Map<string, string>(); // child node id -> parent node id
  for (const n of sessions) {
    if (n.id === rootNodeId) continue;
    const forkParentId = n.parentSessionId ? sessionNodeId(n.parentSessionId) : undefined;
    const parentId = forkParentId && byId.has(forkParentId) ? forkParentId : flowParentOf.get(n.id);
    if (parentId && byId.has(parentId) && parentId !== n.id) parentOf.set(n.id, parentId);
  }

  // Guard against a cycle (stale/corrupt fork-parent data): walk a chain's
  // ancestors before trusting it, drop the link the moment it would revisit
  // a node already on the path (including itself).
  function isAcyclic(id: string): boolean {
    const seen = new Set<string>([id]);
    let cur = parentOf.get(id);
    while (cur) {
      if (seen.has(cur)) return false;
      seen.add(cur);
      cur = parentOf.get(cur);
    }
    return true;
  }
  for (const id of [...parentOf.keys()]) if (!isAcyclic(id)) parentOf.delete(id);

  const childrenOf = new Map<string, CanvasNode[]>();
  for (const [childId, parentId] of parentOf) {
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), byId.get(childId)!]);
  }

  function sessionItem(n: CanvasNode): ChainItem {
    const kids = sortSessions(childrenOf.get(n.id) ?? [], running);
    return { id: n.id, kind: 'session', node: n, areaId: n.area, children: kids.map(sessionItem) };
  }

  const rootSessionsByArea = new Map<AreaId, CanvasNode[]>();
  for (const n of sessions) {
    if (n.id === rootNodeId) continue;
    if (parentOf.has(n.id)) continue; // not a root — hangs under its parent above
    const area = n.area ?? 'outros';
    rootSessionsByArea.set(area, [...(rootSessionsByArea.get(area) ?? []), n]);
  }

  const areaItems: ChainItem[] = AREA_IDS
    .filter((a) => (rootSessionsByArea.get(a) ?? []).length > 0)
    .map((a) => ({
      id: `area:${a}`, kind: 'area' as const, areaId: a,
      children: sortSessions(rootSessionsByArea.get(a) ?? [], running).map(sessionItem),
    }));

  return { id: 'orchestrator', kind: 'orchestrator', node: orchestratorNode, children: areaItems };
}

export const CHAIN_COL_W = 264;
export const CHAIN_ROW_H = 148;
export const CHAIN_NODE_W = 224;
export const CHAIN_NODE_H = 84;

export interface ChainPos {
  id: string;
  item: ChainItem;
  depth: number;
  x: number; // center x, in columns of CHAIN_COL_W
  y: number;
  parentId: string | null;
  descendantCount: number;
  collapsed: boolean;
}

export interface ChainLayoutOpts {
  collapsedAreas: Set<AreaId>;
  collapsedSessions: Set<string>; // session node ids
}

function countDescendants(item: ChainItem): number {
  let n = item.children.length;
  for (const c of item.children) n += countDescendants(c);
  return n;
}

function isCollapsed(item: ChainItem, opts: ChainLayoutOpts): boolean {
  if (item.kind === 'area') return !!item.areaId && opts.collapsedAreas.has(item.areaId);
  if (item.kind === 'session') return opts.collapsedSessions.has(item.id);
  return false;
}

// Classic "children centered over their subtree" tree layout: a leaf (or a
// collapsed branch, treated as a leaf) takes the next free column; an
// internal node centers over its own children's x range. Depth-first so
// sibling order in the tree IS left-to-right order on screen.
export function layoutChainTree(root: ChainItem, opts: ChainLayoutOpts): { positions: ChainPos[]; width: number; height: number } {
  const positions: ChainPos[] = [];
  let col = 0;

  function visit(item: ChainItem, depth: number, parentId: string | null): number {
    const collapsed = isCollapsed(item, opts);
    const descendantCount = countDescendants(item);
    if (collapsed || item.children.length === 0) {
      const x = col * CHAIN_COL_W;
      col++;
      positions.push({ id: item.id, item, depth, x, y: depth * CHAIN_ROW_H, parentId, descendantCount, collapsed });
      return x;
    }
    const childXs = item.children.map((c) => visit(c, depth + 1, item.id));
    const x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    positions.push({ id: item.id, item, depth, x, y: depth * CHAIN_ROW_H, parentId, descendantCount, collapsed: false });
    return x;
  }

  visit(root, 0, null);
  const maxX = Math.max(0, ...positions.map((p) => p.x));
  const maxY = Math.max(0, ...positions.map((p) => p.y));
  return { positions, width: maxX + CHAIN_NODE_W, height: maxY + CHAIN_NODE_H };
}
