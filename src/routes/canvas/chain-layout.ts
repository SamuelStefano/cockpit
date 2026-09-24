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
  // session kind only: how this node's PARENT link was resolved — feeds the
  // fork/flow badge. Undefined for a root session (hangs under its area).
  arrivedVia?: 'fork' | 'flow';
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
  const viaOf = new Map<string, 'fork' | 'flow'>();
  for (const n of sessions) {
    if (n.id === rootNodeId) continue;
    const forkParentId = n.parentSessionId ? sessionNodeId(n.parentSessionId) : undefined;
    const isFork = !!forkParentId && byId.has(forkParentId);
    const parentId = isFork ? forkParentId : flowParentOf.get(n.id);
    if (parentId && byId.has(parentId) && parentId !== n.id) {
      parentOf.set(n.id, parentId);
      viaOf.set(n.id, isFork ? 'fork' : 'flow');
    }
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
    return { id: n.id, kind: 'session', node: n, areaId: n.area, arrivedVia: viaOf.get(n.id), children: kids.map(sessionItem) };
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

// Level 2 (areas) are horizontal COLUMNS sized to fit the viewport (6 areas
// across ~1440px); level 3+ (a session and its own fork/flow children) stack
// VERTICALLY inside its area's column, indented one step per nesting level.
// Review #609 point 1: the previous "one row per tree depth" layout spread
// areas across thousands of horizontal pixels and left session rows mostly
// empty — a column is both narrower and reads top-to-bottom the way a fork
// chain actually happened.
export const CHAIN_AREA_W = 220;
export const CHAIN_AREA_GAP = 16;
export const CHAIN_AREA_H = 40;
export const CHAIN_SESSION_H = 56;
export const CHAIN_SESSION_GAP = 8;
export const CHAIN_INDENT = 18;
export const CHAIN_ROOT_W = 280;
export const CHAIN_ROOT_H = 56;
// Vertical room between the root's bottom and the area row's top — enough
// for the bus-line elbow (all root->area connectors share the same midY,
// which is what makes them read as one horizontal bus rather than N crossing
// diagonals) without crowding the area headers.
export const CHAIN_BUS_GAP = 32;

export interface ChainPos {
  id: string;
  item: ChainItem;
  depth: number;
  x: number; // left, px
  y: number; // top, px
  width: number;
  height: number;
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

// How many of an item's descendants are RUNNING right now — feeds the area
// header's running-count dot (point 2: distinct from the plain total badge).
export function countRunning(item: ChainItem, running: Set<string>): number {
  let n = 0;
  for (const c of item.children) {
    if (c.node && running.has(c.node.ref)) n++;
    n += countRunning(c, running);
  }
  return n;
}

// Running OR waiting-on-you anywhere in the subtree — the signal point 4's
// default-collapse rule reads as "nothing happening here right now".
export function hasLiveSession(item: ChainItem, running: Set<string>): boolean {
  for (const c of item.children) {
    if (c.node && (running.has(c.node.ref) || c.node.waiting)) return true;
    if (hasLiveSession(c, running)) return true;
  }
  return false;
}

// The height an area's column would need if every branch in it were
// expanded — used to decide the default collapse state (point 4) BEFORE any
// real layout runs, so it never depends on the current collapse set.
export function estimateAreaHeight(area: ChainItem): number {
  const rowHeight = (item: ChainItem): number => {
    let h = CHAIN_SESSION_H + CHAIN_SESSION_GAP;
    for (const c of item.children) h += rowHeight(c);
    return h;
  };
  return CHAIN_AREA_H + CHAIN_SESSION_GAP + area.children.reduce((sum, c) => sum + rowHeight(c), 0);
}

function isCollapsed(item: ChainItem, opts: ChainLayoutOpts): boolean {
  if (item.kind === 'area') return !!item.areaId && opts.collapsedAreas.has(item.areaId);
  if (item.kind === 'session') return opts.collapsedSessions.has(item.id);
  return false;
}

// A session (or nested fork/flow child) and everything under it, stacked
// vertically within its area's column — indented one CHAIN_INDENT step per
// nesting level so a chain reads as a small indented tree inside the column,
// not a second row of horizontal siblings. Returns the y just past what it
// drew, so the caller can stack the next sibling directly beneath it.
function layoutColumn(
  item: ChainItem, parentId: string, colX: number, y: number, level: number, opts: ChainLayoutOpts, out: ChainPos[],
): number {
  const collapsed = isCollapsed(item, opts);
  const descendantCount = countDescendants(item);
  const indent = level * CHAIN_INDENT;
  const width = Math.max(CHAIN_AREA_W - indent, CHAIN_AREA_W / 2);
  out.push({ id: item.id, item, depth: level + 2, x: colX + indent, y, width, height: CHAIN_SESSION_H, parentId, descendantCount, collapsed });
  let cursorY = y + CHAIN_SESSION_H + CHAIN_SESSION_GAP;
  if (!collapsed) for (const c of item.children) cursorY = layoutColumn(c, item.id, colX, cursorY, level + 1, opts, out);
  return cursorY;
}

export function layoutChainTree(root: ChainItem, opts: ChainLayoutOpts): { positions: ChainPos[]; width: number; height: number } {
  const positions: ChainPos[] = [];
  const areas = root.children;
  const areaTop = CHAIN_ROOT_H + CHAIN_BUS_GAP;

  let colX = 0;
  let maxBottom = CHAIN_ROOT_H;
  const areaXs: number[] = [];
  for (const area of areas) {
    areaXs.push(colX);
    const collapsed = isCollapsed(area, opts);
    const descendantCount = countDescendants(area);
    positions.push({
      id: area.id, item: area, depth: 1, x: colX, y: areaTop, width: CHAIN_AREA_W, height: CHAIN_AREA_H,
      parentId: root.id, descendantCount, collapsed,
    });
    let bottom = areaTop + CHAIN_AREA_H;
    if (!collapsed) {
      let cursorY = areaTop + CHAIN_AREA_H + CHAIN_SESSION_GAP;
      for (const s of area.children) cursorY = layoutColumn(s, area.id, colX, cursorY, 0, opts, positions);
      bottom = Math.max(bottom, cursorY - CHAIN_SESSION_GAP);
    }
    maxBottom = Math.max(maxBottom, bottom);
    colX += CHAIN_AREA_W + CHAIN_AREA_GAP;
  }

  // Root centers over the full column span (point 1: "orchestrator centered
  // above"), even with zero areas (degenerates to centering over one
  // notional empty column rather than crashing on an empty min/max).
  const firstX = areaXs[0] ?? 0;
  const lastX = areaXs[areaXs.length - 1] ?? 0;
  const spanCenter = (firstX + lastX + CHAIN_AREA_W) / 2;
  positions.push({
    id: root.id, item: root, depth: 0, x: Math.max(0, spanCenter - CHAIN_ROOT_W / 2), y: 0,
    width: CHAIN_ROOT_W, height: CHAIN_ROOT_H, parentId: null, descendantCount: countDescendants(root), collapsed: false,
  });

  const totalAreasWidth = areas.length ? colX - CHAIN_AREA_GAP : CHAIN_ROOT_W;
  return { positions, width: Math.max(totalAreasWidth, CHAIN_ROOT_W), height: maxBottom + 24 };
}
