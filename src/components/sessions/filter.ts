import type { Session } from '../../data/types';

// Ordem/visibilidade da sidebar de sessões. Pura porque um erro aqui some com
// sessões da lista (ou troca a ordem) sem estourar nada — bug calado caro:
// 1) query vazia = todas; query = filtro local (título+snippet) + hits só-por-
//    conteúdo do backend mesclados SEM duplicar (dedup por id);
// 2) fixadas (pinned) sobem ao topo preservando a ordem original entre si.
export function filterSessions(
  sessions: Session[],
  query: string,
  searchResults: Session[],
  pinned: Set<string>,
): Session[] {
  const q = query.trim().toLowerCase();
  const base = q
    ? (() => {
        const local = sessions.filter((s) => (s.title + ' ' + s.snippet).toLowerCase().includes(q));
        const seen = new Set(local.map((s) => s.id));
        return [...local, ...searchResults.filter((s) => !seen.has(s.id))];
      })()
    : sessions;
  if (pinned.size === 0) return base;
  const top = base.filter((s) => pinned.has(s.id));
  const rest = base.filter((s) => !pinned.has(s.id));
  return [...top, ...rest];
}
