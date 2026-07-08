import { useEffect } from 'react';
import { Badge, EmptyState } from '../components/primitives';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { GraphList } from './graph/GraphList';
import { GraphQueryPanel } from './graph/GraphQueryPanel';
import type { GraphQueryState } from '../useCockpit';
import type { GraphData, GraphMeta } from '../../shared/protocol';

interface Props {
  connected: boolean;
  graphs: GraphMeta[];
  loaded: boolean;
  openId: string | null;
  graph: GraphData | null;
  building: boolean;
  buildLog: string[];
  querying: boolean;
  queryResult: GraphQueryState | null;
  onGraphList: () => void;
  onGraphOpen: (id: string) => void;
  onGraphBuild: (repo: string) => void;
  onGraphDelete: (id: string) => void;
  onGraphQuery: (question: string) => void;
}

export function Graph(p: Props) {
  useEffect(() => { if (p.connected) p.onGraphList(); }, [p.connected, p.onGraphList]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800/80 px-4 py-3">
        <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">graph</span>
        <Badge tone="neutral">{p.graphs.length}</Badge>
        <span className="ml-1 text-[11.5px] text-neutral-600">knowledge graph do código · 100% local (tree-sitter)</span>
      </div>

      {!p.connected ? (
        <EmptyState icon="circle" title="Desconectado" description="Reconecte pra listar e gerar grafos." />
      ) : (
        <div className="flex min-h-0 flex-1">
          <GraphList
            graphs={p.graphs} openId={p.openId} building={p.building}
            onOpen={p.onGraphOpen} onDelete={p.onGraphDelete} onBuild={p.onGraphBuild}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            {p.building ? (
              <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-950 p-4">
                <div className="mb-2 font-mono text-[12px] text-orange-300">construindo grafo…</div>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-neutral-500">{p.buildLog.slice(-40).join('\n')}</pre>
              </div>
            ) : p.graph ? (
              <>
                <GraphCanvas graph={p.graph} />
                <GraphQueryPanel querying={p.querying} result={p.queryResult} onQuery={p.onGraphQuery} />
              </>
            ) : (
              <EmptyState
                icon="zap"
                title={p.graphs.length ? 'Selecione um grafo' : 'Nenhum grafo ainda'}
                description={p.graphs.length ? 'Escolha um grafo na lista pra explorar.' : 'Informe o caminho de um repositório à esquerda e gere o primeiro grafo.'}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
