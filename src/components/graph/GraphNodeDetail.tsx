import { Icon, Button } from '../primitives';
import type { GraphNode } from '../../../shared/protocol';
import type { GraphNodeOp } from '../../useCockpit';
import { communityColor, repoColor } from './community-color';

export interface Neighbor { node: GraphNode; relation: string }

interface Props {
  node: GraphNode;
  neighbors: Neighbor[];
  onSelectNeighbor: (n: GraphNode) => void;
  onClose: () => void;
  onNodeOp: (op: GraphNodeOp, a: string) => void;
}

// Painel de detalhe do nó selecionado: identidade + ações (explicar/impacto via
// graphify) + vizinhos clicáveis com a relação (navegar o grafo saltando de nó
// em nó). Vizinhos ordenados por grau (mais central 1º).
export function GraphNodeDetail({ node, neighbors, onSelectNeighbor, onClose, onNodeOp }: Props) {
  return (
    <div className="pointer-events-auto absolute left-3 top-3 flex max-h-[calc(100%-1.5rem)] w-64 flex-col rounded-lg border border-neutral-800 bg-neutral-900/95 shadow-xl backdrop-blur">
      <div className="flex items-start gap-2 border-b border-neutral-800/70 p-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: node.repo ? repoColor(node.repo) : communityColor(node.community) }} />
        <div className="min-w-0 flex-1">
          <div className="break-words font-mono text-[13px] text-neutral-100">{node.label}</div>
          {node.file && <div className="mt-0.5 break-all font-mono text-[10.5px] text-neutral-500">{node.file}{node.loc ? `:${node.loc}` : ''}</div>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {node.repo && <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-orange-300">{node.repo}</span>}
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">{node.deg} conexões</span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fechar detalhe" className="shrink-0 rounded p-0.5 text-neutral-500 hover:text-neutral-200">
          <Icon name="x" size={14} />
        </button>
      </div>

      <div className="flex gap-1.5 border-b border-neutral-800/50 px-3 py-2">
        <Button variant="ghost" size="sm" icon="sparkles" onClick={() => onNodeOp('explain', node.label)}>explicar</Button>
        <Button variant="ghost" size="sm" icon="zap" onClick={() => onNodeOp('affected', node.label)}>impacto</Button>
      </div>

      {neighbors.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="mb-1 px-1 text-[10px] uppercase tracking-wide text-neutral-600">vizinhos</div>
          <ul className="flex flex-col gap-0.5">
            {neighbors.map(({ node: n, relation }) => (
              <li key={n.id}>
                <button
                  onClick={() => onSelectNeighbor(n)}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-neutral-800/70"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.repo ? repoColor(n.repo) : communityColor(n.community) }} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-neutral-300">{n.label}</span>
                  <span className="shrink-0 font-mono text-[9.5px] text-neutral-600">{relation}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
