import type { Session } from '../../data/mock';

// Ordem/visibilidade da sidebar de sessões. Pura porque um erro aqui some com
// sessões da lista (ou troca a ordem) sem estourar nada — bug calado caro:
// 1) query vazia = todas; query = filtro local (título+snippet) + hits só-por-
//    conteúdo do backend mesclados SEM duplicar (dedup por id);
// 2) tagFilter restringe ao tag escolhido;
// 3) fixadas (pinned) sobem ao topo preservando a ordem original entre si.
export function filterSessions(
  sessions: Session[],
  query: string,
  searchResults: Session[],
  pinned: Set<string>,
  tagFilter: string | null,
  tagMap: Record<string, string[]>,
): Session[] {
  const q = query.trim().toLowerCase();
  let base = q
    ? (() => {
        const local = sessions.filter((s) => (s.title + ' ' + s.snippet).toLowerCase().includes(q));
        const seen = new Set(local.map((s) => s.id));
        return [...local, ...searchResults.filter((s) => !seen.has(s.id))];
      })()
    : sessions;
  if (tagFilter) base = base.filter((s) => (tagMap[s.id] || []).includes(tagFilter));
  if (pinned.size === 0) return base;
  const top = base.filter((s) => pinned.has(s.id));
  const rest = base.filter((s) => !pinned.has(s.id));
  return [...top, ...rest];
}
