import { useEffect } from 'react';
import { Badge, Button, EmptyState, Icon, Skeleton } from '../components/primitives';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { GraphList } from './graph/GraphList';
import { GraphQueryPanel } from './graph/GraphQueryPanel';
import type { GraphQueryState, GraphNodeOp } from '../useCockpit';
import type { GraphData, GraphMeta } from '../../shared/protocol';

interface Props {
  connected: boolean;
  graphs: GraphMeta[];
  loaded: boolean;
  openId: string | null;
  opening: string | null;
  graph: GraphData | null;
  building: boolean;
  buildLog: string[];
  buildError: string | null;
  querying: boolean;
  queryResult: GraphQueryState | null;
  queryHistory: GraphQueryState[];
  onGraphList: () => void;
  onGraphOpen: (id: string) => void;
  onGraphBuild: (repo: string) => void;
  onClearBuildError: () => void;
  onGraphDelete: (id: string) => void;
  onGraphQuery: (question: string, budget?: number) => void;
  onGraphNodeOp: (op: GraphNodeOp, a: string, b?: string) => void;
}

export function Graph(p: Props) {
  useEffect(() => { if (p.connected) p.onGraphList(); }, [p.connected, p.onGraphList]);
  const openingThis = !!p.opening && p.opening !== p.openId;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800/80 px-4 py-3">
        <span className="font-mono text-[14px] font-semibold lowercase tracking-tight text-neutral-100">graph</span>
        <Badge tone="neutral">{p.graphs.length}</Badge>
        <span className="ml-1 text-[11.5px] text-neutral-600">knowledge graph do código · 100% local (tree-sitter)</span>
      </div>

      {p.buildError && (
        <div className="flex shrink-0 items-start gap-2 border-b border-red-500/20 bg-red-500/[0.06] px-4 py-2.5">
          <Badge tone="red">build falhou</Badge>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-neutral-300">{p.buildError}</div>
            {p.buildLog.length > 0 && (
              <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-neutral-600">{p.buildLog.slice(-12).join('\n')}</pre>
            )}
          </div>
          <Button variant="ghost" size="sm" icon="x" onClick={p.onClearBuildError}>fechar</Button>
        </div>
      )}

      {!p.connected ? (
        <EmptyState icon="circle" title="Desconectado" description="Reconecte pra listar e gerar grafos." />
      ) : (
        <div className="flex min-h-0 flex-1">
          <GraphList
            graphs={p.graphs} openId={p.openId} opening={p.opening} building={p.building}
            onOpen={p.onGraphOpen} onDelete={p.onGraphDelete} onBuild={p.onGraphBuild}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            {p.building ? (
              <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-950 p-4">
                <div className="mb-2 flex items-center gap-2 font-mono text-[12px] text-orange-300"><Icon name="rotate" size={13} className="animate-spin" /> construindo grafo…</div>
                <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-neutral-500">{p.buildLog.slice(-40).join('\n')}</pre>
              </div>
            ) : openingThis ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
                <Skeleton className="h-40 w-40 rounded-full" />
                <span className="font-mono text-[12px] text-neutral-500">abrindo grafo…</span>
              </div>
            ) : p.graph ? (
              <>
                <GraphCanvas graph={p.graph} onNodeOp={p.onGraphNodeOp} />
                <GraphQueryPanel querying={p.querying} result={p.queryResult} history={p.queryHistory} onQuery={p.onGraphQuery} />
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
