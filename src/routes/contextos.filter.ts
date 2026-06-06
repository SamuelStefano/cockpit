import type { ContextMeta } from '../../shared/protocol';

export function countByType(contexts: ContextMeta[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of contexts) m[c.type] = (m[c.type] ?? 0) + 1;
  return m;
}

export function filterContexts(contexts: ContextMeta[], query: string, type: string | null): ContextMeta[] {
  const q = query.trim().toLowerCase();
  return contexts.filter((c) => {
    if (type && c.type !== type) return false;
    if (!q) return true;
    return (c.title + ' ' + c.description + ' ' + c.type).toLowerCase().includes(q);
  });
}
