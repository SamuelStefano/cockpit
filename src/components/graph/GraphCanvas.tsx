import { Button } from '../primitives';
import type { GraphData, GraphNode } from '../../../shared/protocol';
import { useForceGraph } from './useForceGraph';
import { communityColor } from './community-color';

interface Props {
  graph: GraphData;
  selectedId?: string;
  onSelect?: (n: GraphNode) => void;
}

export function GraphCanvas({ graph, selectedId, onSelect }: Props) {
  const { canvasRef, hovered, resetView } = useForceGraph(graph, { selectedId, onSelect });

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-950">
      <canvas ref={canvasRef} className="h-full w-full" style={{ cursor: 'grab' }} />

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-[11px] text-neutral-500">
        <span><span className="text-neutral-300">{graph.nodes.length.toLocaleString('pt-BR')}</span> nós · <span className="text-neutral-300">{graph.edges.length.toLocaleString('pt-BR')}</span> arestas · <span className="text-neutral-300">{graph.communities.length}</span> comunidades</span>
        {graph.truncated && (
          <span className="text-amber-500/80">mostrando os {graph.nodes.length.toLocaleString('pt-BR')} nós mais conectados de {graph.totalNodes.toLocaleString('pt-BR')}</span>
        )}
        <span className="text-neutral-600">arraste p/ mover · scroll p/ zoom · clique num nó</span>
      </div>

      <div className="absolute right-3 top-3">
        <Button variant="outline" size="sm" icon="rotate" onClick={resetView}>enquadrar</Button>
      </div>

      {hovered && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-xs rounded-lg border border-neutral-800 bg-neutral-900/95 px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: communityColor(hovered.community) }} />
            <span className="truncate font-mono text-[12.5px] text-neutral-100">{hovered.label}</span>
          </div>
          {hovered.file && (
            <div className="mt-1 truncate font-mono text-[11px] text-neutral-500">{hovered.file}{hovered.loc ? `:${hovered.loc}` : ''}</div>
          )}
          <div className="mt-1 text-[11px] text-neutral-500">{hovered.communityName ?? `Comunidade ${hovered.community}`} · {hovered.deg} conexões</div>
        </div>
      )}
    </div>
  );
}
