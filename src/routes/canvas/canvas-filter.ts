import type { CanvasCard, CanvasEdge, CanvasNode } from '../../../shared/canvas';

export type CanvasScope = 'active' | 'all';

export interface FilterOpts {
  scope: CanvasScope;
  archived: boolean;
  query: string;
  running: Set<string>;
  cards: CanvasCard[];
  now: number;
}

export const ACTIVE_WINDOW_MS = 7 * 24 * 3600_000;

// "Active" keeps what is alive this week — running or recent sessions and open
// cards — plus every context they touch and the hubs above those contexts, so
// the map shows where the work sits without the whole year of history.
export function filterCanvas(nodes: CanvasNode[], edges: CanvasEdge[], o: FilterOpts): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const openCards = new Set(o.cards.filter((c) => c.status !== 'done').map((c) => `k:${c.id}`));
  const nbrs = new Map<string, string[]>();
  for (const e of edges) {
    nbrs.set(e.source, [...(nbrs.get(e.source) ?? []), e.target]);
    nbrs.set(e.target, [...(nbrs.get(e.target) ?? []), e.source]);
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const allowed = (n: CanvasNode) => o.archived || !n.archived || o.running.has(n.ref);

  let keep = new Set<string>();
  if (o.scope === 'all') {
    for (const n of nodes) if (allowed(n)) keep.add(n.id);
  } else {
    const seeds = nodes.filter((n) => allowed(n) && (
      (n.kind === 'session' && (o.running.has(n.ref) || o.now - n.mtime < ACTIVE_WINDOW_MS)) ||
      (n.kind === 'card' && openCards.has(n.id))
    ));
    for (const s of seeds) {
      keep.add(s.id);
      for (const id of nbrs.get(s.id) ?? []) {
        const n = byId.get(id);
        if (n?.kind === 'context' && allowed(n)) keep.add(id);
      }
    }
    for (const e of edges) {
      if (e.kind === 'link' && keep.has(e.target) && byId.get(e.source)?.hub) keep.add(e.source);
    }
  }

  const q = o.query.trim().toLowerCase();
  if (q) {
    const hit = [...keep].filter((id) => {
      const n = byId.get(id)!;
      return `${n.title} ${n.subtitle} ${n.ref}`.toLowerCase().includes(q);
    });
    const next = new Set(hit);
    for (const id of hit) for (const nb of nbrs.get(id) ?? []) if (keep.has(nb)) next.add(nb);
    keep = next;
  }

  return {
    nodes: nodes.filter((n) => keep.has(n.id)),
    edges: edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
  };
}

export function neighbors(edges: CanvasEdge[], id: string): Set<string> {
  const out = new Set<string>();
  for (const e of edges) {
    if (e.source === id) out.add(e.target);
    else if (e.target === id) out.add(e.source);
  }
  return out;
}
