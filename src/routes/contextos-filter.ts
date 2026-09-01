import type { ContextMeta } from '../../shared/protocol';

export function countByType(contexts: ContextMeta[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of contexts) m[c.type] = (m[c.type] ?? 0) + 1;
  return m;
}

// Normaliza pra casar wikilink (`[[user-role]]`) com id/title do contexto: tira
// caixa e qualquer separador (espaço, hífen, underscore). Assim `user-role`,
// `user_role` e `User Role` resolvem pro mesmo arquivo.
function normKey(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, '');
}

// Resolve o alvo de um wikilink pro id do contexto correspondente, ou null se
// nenhum casar. O id (filename) tem prioridade sobre o title.
export function resolveWikilink(contexts: ContextMeta[], name: string): string | null {
  const target = normKey(name);
  if (!target) return null;
  const byId = contexts.find((c) => normKey(c.id) === target);
  if (byId) return byId.id;
  const byTitle = contexts.find((c) => normKey(c.title) === target);
  return byTitle ? byTitle.id : null;
}

export function filterContexts(contexts: ContextMeta[], query: string, type: string | null): ContextMeta[] {
  const q = query.trim().toLowerCase();
  return contexts
    .filter((c) => {
      if (type && c.type !== type) return false;
      if (!q) return true;
      return (c.title + ' ' + c.description + ' ' + c.type).toLowerCase().includes(q);
    })
    .sort((a, b) => b.mtime - a.mtime);
}
