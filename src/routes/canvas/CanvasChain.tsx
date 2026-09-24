import { useEffect, useRef } from 'react';
import type { AreaId, CanvasFlow, CanvasNode, OrchestratorInfo, TermStats } from '../../../shared/canvas';
import { EmptyState } from '../../components/primitives';
import { ChainNode } from './ChainNode';
import { CHAIN_AREA_H, CHAIN_ROOT_W, CHAIN_SESSION_H, countRunning, type ChainItem } from './chain-layout';
import { useCanvasChain } from './useCanvasChain';

interface Props {
  nodes: CanvasNode[]; // scope/area/query-filtered set (r.visible.nodes) — same session set the map shows
  flows: CanvasFlow[];
  running: Set<string>;
  waiting: Set<string>;
  stats: Record<string, TermStats>;
  orchestrator?: OrchestratorInfo;
  onOpenTerm: (nodeId: string) => void;
  onOpenChat: (sessionId: string) => void;
}

// Org-chart / top-down tree: Orchestrator -> area -> session -> its own fork
// or flow children. Desktop/tablet gets the absolute-positioned SVG-elbow
// layout (useCanvasChain); a narrow viewport (<=640px) falls back to a
// plain indented list — no horizontal scroll to fight on a phone.
export function CanvasChain(p: Props) {
  const chain = useCanvasChain(p.nodes, p.flows, p.running, p.orchestrator);

  if (chain.tree.children.length === 0) {
    return <EmptyState icon="command" title="Nada na cadeia" description="Ajuste os filtros — o mesmo escopo do canvas/kanban vale aqui." />;
  }

  if (chain.narrow) {
    return (
      // min-w-0 + overflow-x-hidden: without them a deep tree's row content
      // (title + badges + buttons, none of it wrapping) pushed the list wider
      // than the 390px viewport instead of truncating (UX review 24/09
      // item 11 — the Orchestrator row was cut mid-word at "ORCHE").
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
        <ChainTreeList
          item={chain.tree} depth={0} running={p.running} waiting={p.waiting} stats={p.stats}
          collapsedAreas={chain.collapsedAreas} collapsedSessions={chain.collapsedSessions}
          onToggleArea={chain.toggleArea} onToggleSession={chain.toggleSession}
          onOpenTerm={p.onOpenTerm} onOpenChat={p.onOpenChat}
        />
      </div>
    );
  }

  return <ChainCanvas chain={chain} p={p} />;
}

// The root centers over ALL its area children (chain-layout.ts's classic
// tree-layout math), which on a wide org chart sits far to the right of x=0
// — without this, opening "cadeia" shows only the first area's leaves,
// orchestrator and area rows scrolled clean out of view. Scrolled ONCE per
// tree width (not on every reposition from a collapse toggle, which would
// yank the view back to center after the user just scrolled somewhere else).
function ChainCanvas({ chain, p }: { chain: ReturnType<typeof useCanvasChain>; p: Props }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootX = chain.positions.find((pos) => pos.item.kind === 'orchestrator')?.x ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, rootX + CHAIN_ROOT_W / 2 - el.clientWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the tree's overall width should re-center, not every scroll/collapse.
  }, [chain.width]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-6">
      <div className="relative" style={{ width: chain.width, height: chain.height }}>
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={chain.width} height={chain.height}>
          {chain.edges.map((e) => <path key={e.id} d={e.d} fill="none" stroke="rgb(64 64 64)" strokeWidth={1.5} />)}
        </svg>
        {chain.positions.map((pos) => (
          <div key={pos.id} className="absolute" style={{ left: pos.x, top: pos.y, width: pos.width, height: pos.height }}>
            <ChainNode
              item={pos.item} running={pos.item.node ? p.running.has(pos.item.node.ref) : false}
              waiting={pos.item.node ? p.waiting.has(pos.item.node.ref) : false}
              stats={pos.item.node ? p.stats[pos.item.node.ref] : undefined}
              descendantCount={pos.descendantCount} collapsed={pos.collapsed} runningCount={countRunning(pos.item, p.running)}
              onToggleCollapse={() => (pos.item.kind === 'area' && pos.item.areaId ? chain.toggleArea(pos.item.areaId) : chain.toggleSession(pos.item.id))}
              onOpenTerm={() => onOpenNode(pos.item, p)} onOpenChat={() => (pos.item.node ? p.onOpenChat(pos.item.node.ref) : undefined)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function onOpenNode(item: { kind: string; id: string }, p: Props) {
  if (item.kind === 'session') p.onOpenTerm(item.id);
}

interface ListProps {
  item: ChainItem;
  depth: number;
  running: Set<string>;
  waiting: Set<string>;
  stats: Record<string, TermStats>;
  collapsedAreas: Set<AreaId>;
  collapsedSessions: Set<string>;
  onToggleArea: (a: AreaId) => void;
  onToggleSession: (id: string) => void;
  onOpenTerm: (nodeId: string) => void;
  onOpenChat: (sessionId: string) => void;
}

// Same nodes, same collapse state, just stacked with indentation instead of
// positioned absolutely — no separate data model for the mobile fallback.
function countDescendants(item: ChainItem): number {
  let n = item.children.length;
  for (const c of item.children) n += countDescendants(c);
  return n;
}

export const CHAIN_LIST_INDENT = 14;

function ChainTreeList(p: ListProps) {
  const { item } = p;
  const collapsed = item.kind === 'area' ? (!!item.areaId && p.collapsedAreas.has(item.areaId)) : p.collapsedSessions.has(item.id);
  const descendantCount = countDescendants(item);
  const rowH = item.kind === 'session' ? CHAIN_SESSION_H : CHAIN_AREA_H;
  return (
    // One step per level: each child renders INSIDE its parent's div, so the
    // margins add up — `depth * 14` compounded (14, 42, 84, 140…) and a 5-deep
    // fork chain left a 50px-wide row with no title on a 375px phone.
    <div style={{ marginLeft: p.depth ? CHAIN_LIST_INDENT : 0 }} className="mb-1.5">
      <div style={{ height: rowH }}>
        <ChainNode
          item={item} running={item.node ? p.running.has(item.node.ref) : false} waiting={item.node ? p.waiting.has(item.node.ref) : false}
          stats={item.node ? p.stats[item.node.ref] : undefined} descendantCount={descendantCount} collapsed={collapsed}
          runningCount={countRunning(item, p.running)}
          onToggleCollapse={() => (item.kind === 'area' && item.areaId ? p.onToggleArea(item.areaId) : p.onToggleSession(item.id))}
          onOpenTerm={() => (item.kind === 'session' ? p.onOpenTerm(item.id) : undefined)}
          onOpenChat={() => (item.node ? p.onOpenChat(item.node.ref) : undefined)}
        />
      </div>
      {!collapsed && item.children.map((c) => <ChainTreeList key={c.id} {...p} item={c} depth={p.depth + 1} />)}
    </div>
  );
}
