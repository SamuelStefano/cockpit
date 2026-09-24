import { isCronPing, type AreaId, type CanvasCard, type CanvasEdge, type CanvasNode } from '../../../shared/canvas';
import { isAutomationSession } from './canvas-automation';
import type { LiveSessionInfo } from './kanban-items';

export type CanvasScope = 'exec' | 'active' | 'all';

export interface FilterOpts {
  scope: CanvasScope;
  archived: boolean;
  query: string;
  running: Set<string>;
  cards: CanvasCard[];
  now: number;
  area?: AreaId | null; // null/undefined = every area
  // 'exec' scope only, both optional so every other caller/test is unaffected:
  // raw open-terminal-window node ids (useCanvasTerms' own `open`, NOT the
  // scope-filtered `windows` useCanvasRoute derives from it — that would be
  // circular, windows depends on the already-filtered visible set) and the
  // session node ids kanban-items.ts's doneRecentSessionIds flags as Done but
  // not yet Completed within the last 24h.
  windowIds?: Set<string>;
  doneRecentIds?: Set<string>;
  showAutomation?: boolean;
  // The freshest `waiting` per session (src/data/types.ts Session, via
  // p.sessions) — the graph node can be a whole rebuild behind. Falls back to
  // the node's own `waiting` when a session isn't in the live list yet.
  liveSessions?: Map<string, LiveSessionInfo>;
  // 'exec'/'active' only: memory context/hub nodes (and the giant floating hub
  // labels + their crowding on top of session windows) are noise for "what's
  // happening right now" — default OFF, a toggle brings them back. 'all' scope
  // always shows everything regardless, since that view IS the memory map.
  showContexts?: boolean;
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
  } else if (o.scope === 'exec') {
    // The execution panel: only sessions that are actually happening right
    // now (running, waiting on you, sitting in an open terminal window, or
    // just finished and not yet triaged into Completed) — never a hub, never
    // an untouched leaf, never the archive. Session neighbours are restricted
    // to 'read'/'write' context edges (the sessions' OWN memory touches), so
    // no hub-promotion and no topic/link neighbour ever sneaks a whole
    // cluster of old contexts back in the way 'active' scope does.
    //
    // Cards not yet Completed are seeds too — otherwise every #592 flow arrow
    // and #593 card alert touching a card, and every area chip around it
    // (#595), vanishes the moment its bound session goes idle between turns.
    // A card's own edges are always 'card'/'input' (graph.ts never emits
    // read/write FROM a card), so no kind filter is needed for it.
    //
    // Indexed by source once (O(edges)) instead of scanning the whole edge
    // list per seed (O(seeds × edges) — measurable on a box with 300+
    // sessions and thousands of edges).
    const showAuto = o.showAutomation ?? false;
    const bySource = new Map<string, CanvasEdge[]>();
    for (const e of edges) bySource.set(e.source, [...(bySource.get(e.source) ?? []), e]);

    const sessionSeeds = nodes.filter((n) => n.kind === 'session' && allowed(n) && (showAuto || !isAutomationSession({ title: n.title, subtitle: n.subtitle })) && (
      o.running.has(n.ref) || (o.liveSessions?.get(n.ref)?.waiting ?? n.waiting) || (o.windowIds?.has(n.id) ?? false) || (o.doneRecentIds?.has(n.id) ?? false)
    ));
    for (const s of sessionSeeds) {
      keep.add(s.id);
      for (const e of bySource.get(s.id) ?? []) {
        if (e.kind !== 'read' && e.kind !== 'write') continue;
        const t = byId.get(e.target);
        if (t?.kind === 'context' && allowed(t)) keep.add(e.target);
      }
    }
    for (const c of nodes.filter((n) => n.kind === 'card' && openCards.has(n.id))) {
      keep.add(c.id);
      for (const e of bySource.get(c.id) ?? []) {
        const t = byId.get(e.target);
        if (t && allowed(t)) keep.add(e.target);
      }
    }
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

  if (o.scope !== 'all' && !o.showContexts) {
    for (const id of [...keep]) if (byId.get(id)?.kind === 'context') keep.delete(id);
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
