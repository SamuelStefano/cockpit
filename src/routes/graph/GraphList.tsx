import { useState } from 'react';
import { Icon, Button, Badge } from '../../components/primitives';
import type { GraphMeta } from '../../../shared/protocol';

interface Props {
  graphs: GraphMeta[];
  openId: string | null;
  building: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onBuild: (repo: string) => void;
}

export function GraphList({ graphs, openId, building, onOpen, onDelete, onBuild }: Props) {
  const [repo, setRepo] = useState('');
  const submit = () => { const r = repo.trim(); if (r && !building) { onBuild(r); setRepo(''); } };

  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-neutral-800/80 bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/60 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 focus-within:border-orange-500/40">
          <Icon name="plus" size={13} className="shrink-0 text-neutral-500" />
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="caminho do repo…"
            aria-label="Caminho do repositório para gerar o grafo"
            className="w-full bg-transparent font-mono text-[12px] text-neutral-200 placeholder-neutral-600 outline-none"
          />
        </div>
        <Button variant="primary" size="sm" icon="zap" loading={building} disabled={!repo.trim() || building}
          onClick={submit} className="mt-2 w-full justify-center">
          {building ? 'construindo…' : 'gerar grafo'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {graphs.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-neutral-600">nenhum grafo ainda</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {graphs.map((g) => (
              <li key={g.id}>
                <button
                  onClick={() => onOpen(g.id)}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    openId === g.id ? 'bg-orange-500/[0.10] text-orange-200' : 'text-neutral-300 hover:bg-neutral-900'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate font-mono text-[12.5px]">
                      {g.id === 'global' && <Icon name="sparkles" size={12} className="shrink-0 text-orange-400" />}
                      {g.label}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-neutral-500">
                      <Badge tone="neutral">{g.nodes.toLocaleString('pt-BR')} nós</Badge>
                      <span>{g.edges.toLocaleString('pt-BR')} arestas</span>
                    </div>
                  </div>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Excluir grafo ${g.label}`}
                    onClick={(e) => { e.stopPropagation(); onDelete(g.id); }}
                    className="shrink-0 rounded p-1 text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Icon name="trash" size={13} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
