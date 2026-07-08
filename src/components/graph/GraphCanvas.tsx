import { useEffect, useRef } from 'react';
import type { GraphData, GraphNode } from '../../../shared/protocol';
import { useForceGraph } from './useForceGraph';
import { useGraphExplorer } from './useGraphExplorer';
import { communityColor, repoColor } from './community-color';
import { GraphControls } from './GraphControls';
import { GraphLegend } from './GraphLegend';
import { GraphNodeDetail } from './GraphNodeDetail';

interface Props {
  graph: GraphData;
}

export function GraphCanvas({ graph }: Props) {
  const x = useGraphExplorer(graph);
  const { canvasRef, hovered, resetView, focusNode } = useForceGraph(graph, {
    selectedId: x.selectedId, onSelect: x.selectNode,
    colorMode: x.colorMode, query: x.query, focusRepo: x.focusRepo,
  });

  // Busca: ao digitar, centraliza no 1º match (feedback imediato de onde está).
  const lastFocused = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (x.firstMatchId && x.firstMatchId !== lastFocused.current) {
      lastFocused.current = x.firstMatchId;
      focusNode(x.firstMatchId);
    }
    if (!x.query) lastFocused.current = undefined;
  }, [x.firstMatchId, x.query, focusNode]);

  const selectNeighbor = (n: GraphNode) => { x.selectNode(n); focusNode(n.id); };
  const dotColor = (n: GraphNode) => (x.colorMode === 'repo' && n.repo ? repoColor(n.repo) : communityColor(n.community));

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-neutral-950">
      <canvas ref={canvasRef} className="h-full w-full" style={{ cursor: 'grab' }} />

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-[11px] text-neutral-500">
        <span><span className="text-neutral-300">{graph.nodes.length.toLocaleString('pt-BR')}</span> nós · <span className="text-neutral-300">{graph.edges.length.toLocaleString('pt-BR')}</span> arestas · <span className="text-neutral-300">{x.hasRepos ? x.repos.length : graph.communities.length}</span> {x.hasRepos ? 'apps' : 'comunidades'}</span>
        {graph.truncated && (
          <span className="text-amber-500/80">mostrando os {graph.nodes.length.toLocaleString('pt-BR')} nós mais conectados de {graph.totalNodes.toLocaleString('pt-BR')}</span>
        )}
        <span className="text-neutral-600">arraste · scroll p/ zoom · clique num nó</span>
      </div>

      <GraphControls
        query={x.query} onQuery={x.setQuery} matchCount={x.matchCount}
        colorMode={x.colorMode} onColorMode={x.setColorMode} showColorToggle={x.hasRepos}
        onReset={resetView}
      />

      {x.colorMode === 'repo' && (
        <GraphLegend repos={x.repos} focusRepo={x.focusRepo} onFocusRepo={x.setFocusRepo} />
      )}

      {x.selectedNode ? (
        <GraphNodeDetail node={x.selectedNode} neighbors={x.neighbors} onSelectNeighbor={selectNeighbor} onClose={x.clearSelection} />
      ) : hovered ? (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-xs rounded-lg border border-neutral-800 bg-neutral-900/95 px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dotColor(hovered) }} />
            <span className="truncate font-mono text-[12.5px] text-neutral-100">{hovered.label}</span>
            {hovered.repo && <span className="shrink-0 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-orange-300">{hovered.repo}</span>}
          </div>
          {hovered.file && (
            <div className="mt-1 truncate font-mono text-[11px] text-neutral-500">{hovered.file}{hovered.loc ? `:${hovered.loc}` : ''}</div>
          )}
          <div className="mt-1 text-[11px] text-neutral-500">{hovered.communityName ?? `Comunidade ${hovered.community}`} · {hovered.deg} conexões</div>
        </div>
      ) : null}
    </div>
  );
}
