import type { AreaId, CanvasFlow, CanvasNode, OrchestratorInfo, TermStats } from '../../../shared/canvas';
import { EmptyState } from '../../components/primitives';
import { ChainNode } from './ChainNode';
import { CHAIN_NODE_H, CHAIN_NODE_W } from './chain-layout';
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
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <ChainTreeList
          item={chain.tree} depth={0} running={p.running} waiting={p.waiting} stats={p.stats}
          collapsedAreas={chain.collapsedAreas} collapsedSessions={chain.collapsedSessions}
          onToggleArea={chain.toggleArea} onToggleSession={chain.toggleSession}
          onOpenTerm={p.onOpenTerm} onOpenChat={p.onOpenChat}
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-6">
      <div className="relative" style={{ width: chain.width, height: chain.height }}>
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={chain.width} height={chain.height}>
          {chain.edges.map((e) => <path key={e.id} d={e.d} fill="none" stroke="rgb(64 64 64)" strokeWidth={1.5} />)}
        </svg>
        {chain.positions.map((pos) => (
          <div key={pos.id} className="absolute" style={{ left: pos.x, top: pos.y, width: CHAIN_NODE_W, height: CHAIN_NODE_H }}>
            <ChainNode
              item={pos.item} running={pos.item.node ? p.running.has(pos.item.node.ref) : false}
              waiting={pos.item.node ? p.waiting.has(pos.item.node.ref) : false}
              stats={pos.item.node ? p.stats[pos.item.node.ref] : undefined}
              descendantCount={pos.descendantCount} collapsed={pos.collapsed}
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
  item: import('./chain-layout').ChainItem;
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
function ChainTreeList(p: ListProps) {
  const { item } = p;
  const collapsed = item.kind === 'area' ? (!!item.areaId && p.collapsedAreas.has(item.areaId)) : p.collapsedSessions.has(item.id);
  const descendantCount = countDescendants(item);
  return (
    <div style={{ marginLeft: p.depth * 14 }} className="mb-1.5">
      <div style={{ height: CHAIN_NODE_H }}>
        <ChainNode
          item={item} running={item.node ? p.running.has(item.node.ref) : false} waiting={item.node ? p.waiting.has(item.node.ref) : false}
          stats={item.node ? p.stats[item.node.ref] : undefined} descendantCount={descendantCount} collapsed={collapsed}
          onToggleCollapse={() => (item.kind === 'area' && item.areaId ? p.onToggleArea(item.areaId) : p.onToggleSession(item.id))}
          onOpenTerm={() => (item.kind === 'session' ? p.onOpenTerm(item.id) : undefined)}
          onOpenChat={() => (item.node ? p.onOpenChat(item.node.ref) : undefined)}
        />
      </div>
      {!collapsed && item.children.map((c) => <ChainTreeList key={c.id} {...p} item={c} depth={p.depth + 1} />)}
    </div>
  );
}

function countDescendants(item: { children: { children: unknown[] }[] }): number {
  let n = item.children.length;
  for (const c of item.children) n += countDescendants(c as { children: { children: unknown[] }[] });
  return n;
}
