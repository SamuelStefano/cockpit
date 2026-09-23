import { isCronPing, type AreaId, type CanvasCard, type CanvasEdge, type CanvasNode } from '../../../shared/canvas';

export type CanvasScope = 'active' | 'all';

export interface FilterOpts {
  scope: CanvasScope;
  archived: boolean;
  query: string;
  running: Set<string>;
  cards: CanvasCard[];
  now: number;
  area?: AreaId | null; // null/undefined = every area
}

// "Active" used to mean "touched in the last 7 days", which at 300 sessions
// mostly means "everything" — the whole point was a real-time picture of what
// the Deck is doing right now. 48h keeps the sidebar's own sense of "recent"
// (running/waiting sessions are always in regardless of the window).
export const ACTIVE_WINDOW_MS = 48 * 3600_000;

// A cron-reset ping or a session with no real turn yet is noise in the
// sidebar (isCronPing already hides it there) and would be noise here too —
// letting it "count" as active just to fill the empty-context cluster with
// junk. It can still show up under "all", or via `running`/`waiting`.
function isNoise(n: CanvasNode): boolean {
  // `count` is undefined for a fixture/old node shape, not for a real empty
  // session (the scanner always sets it) — only an explicit 0 counts as noise.
  return isCronPing({ title: n.title, snippet: n.subtitle }) || n.count === 0;
}

// "Active" keeps what is alive right now — running, waiting on you, or with
// real activity in the last 48h — plus open cards, every context they touch,
// and the hubs above those contexts, so the map shows where the work sits
// without the whole year of history.
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
      (n.kind === 'session' && !isNoise(n) && (o.running.has(n.ref) || n.waiting || o.now - n.mtime < ACTIVE_WINDOW_MS)) ||
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

  if (o.area) {
    for (const id of [...keep]) if (byId.get(id)?.area !== o.area) keep.delete(id);
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
