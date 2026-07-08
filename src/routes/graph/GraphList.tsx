import { useState, useRef } from 'react';
import { Icon, Button, Badge, Input } from '../../components/primitives';
import type { GraphMeta } from '../../../shared/protocol';

interface Props {
  graphs: GraphMeta[];
  openId: string | null;
  opening: string | null;
  building: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onBuild: (repo: string) => void;
}

export function GraphList({ graphs, openId, opening, building, onOpen, onDelete, onBuild }: Props) {
  const [repo, setRepo] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submit = () => { const r = repo.trim(); if (r && !building) { onBuild(r); setRepo(''); } };

  // Delete em dois estágios: 1º clique arma "confirmar?" por 3s; 2º clique dentro
  // da janela executa. Evita exclusão acidental sem um modal.
  const clickDelete = (id: string) => {
    if (pendingDelete === id) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setPendingDelete(null);
      onDelete(id);
      return;
    }
    setPendingDelete(id);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setPendingDelete(null), 3000);
  };

  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-neutral-800/80 bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-800/60 p-3">
        <Input
          icon="plus" mono size="sm" value={repo}
          onChange={(e) => setRepo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="caminho do repo…"
          aria-label="Caminho do repositório para gerar o grafo"
        />
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
              <li key={g.id} className="group relative">
                <button
                  onClick={() => onOpen(g.id)}
                  className={`flex w-full items-center gap-2 rounded-lg py-2 pl-2.5 pr-8 text-left transition-colors ${
                    openId === g.id ? 'bg-orange-500/[0.10] text-orange-200' : 'text-neutral-300 hover:bg-neutral-900'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate font-mono text-[12.5px]">
                      {g.id === 'global' && <Icon name="sparkles" size={12} className="shrink-0 text-orange-400" />}
                      {g.label}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-neutral-500">
                      <Badge tone="neutral">{g.nodes.toLocaleString('pt-BR')} nós</Badge>
                      <span>{g.edges.toLocaleString('pt-BR')} arestas</span>
                      {g.ratio && <Badge tone="green">~{g.ratio}x menos tokens</Badge>}
                    </div>
                  </div>
                </button>
                {opening === g.id ? (
                  <span className="absolute right-2 top-2 text-neutral-500"><Icon name="rotate" size={13} className="animate-spin" /></span>
                ) : g.id !== 'global' ? (
                  <button
                    aria-label={pendingDelete === g.id ? `Confirmar exclusão de ${g.label}` : `Excluir grafo ${g.label}`}
                    onClick={() => clickDelete(g.id)}
                    className={`absolute right-1.5 top-1.5 rounded px-1 py-0.5 transition-opacity ${
                      pendingDelete === g.id ? 'font-mono text-[10px] text-red-400 opacity-100' : 'text-neutral-600 opacity-0 hover:text-red-400 focus:opacity-100 group-hover:opacity-100'
                    }`}
                  >
                    {pendingDelete === g.id ? 'confirmar?' : <Icon name="trash" size={13} />}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
