import { repoColor } from './community-color';

export interface RepoStat { repo: string; count: number }

interface Props {
  repos: RepoStat[];
  focusRepo: string | null;
  onFocusRepo: (repo: string | null) => void;
}

// Legenda dos apps no grafo global. Clicar num app isola seus nós (esmaece o
// resto); clicar de novo (ou no ativo) limpa. Só aparece no modo "por app".
export function GraphLegend({ repos, focusRepo, onFocusRepo }: Props) {
  if (repos.length < 2) return null;
  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 max-h-[46%] w-52 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900/95 p-2 shadow-lg backdrop-blur">
      <div className="mb-1.5 px-1 text-[10px] uppercase tracking-wide text-neutral-600">{repos.length} apps</div>
      <ul className="flex flex-col gap-0.5">
        {repos.map((r) => {
          const active = focusRepo === r.repo;
          return (
            <li key={r.repo}>
              <button
                onClick={() => onFocusRepo(active ? null : r.repo)}
                className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors ${
                  active ? 'bg-orange-500/15' : 'hover:bg-neutral-800/70'
                } ${focusRepo && !active ? 'opacity-45' : ''}`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: repoColor(r.repo) }} />
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-neutral-300">{r.repo}</span>
                <span className="shrink-0 font-mono text-[10px] text-neutral-600">{r.count.toLocaleString('pt-BR')}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
