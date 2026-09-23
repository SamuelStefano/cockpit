import type { SessionMeta } from '../../shared/protocol';
import {
  type CanvasCard, type CanvasEdge, type CanvasEdgeKind, type CanvasGraph, type CanvasNode,
  cardNodeId, contextNodeId, sessionNodeId,
} from '../../shared/canvas';
import type { SessionRefs } from './refs';
import { createTopicMatcher, type MatchDoc } from './topics';
import { classifyAreas } from './areas';

export interface ContextDoc {
  id: string;
  name: string;
  title: string;
  description: string;
  mtime: number;
  links: string[];
  origin?: string;
  archived?: boolean;
  path: string;
}

export interface GraphInput {
  sessions: { meta: SessionMeta; archived: boolean }[];
  refs: Map<string, SessionRefs>;
  contexts: ContextDoc[];
  cards: CanvasCard[];
  now?: number;
}

// Wikilinks name memories by slug or by frontmatter name, with - and _ used
// interchangeably ([[hub_deck]] and [[hub-deck]] are the same file).
export const linkKey = (s: string) => s.trim().toLowerCase().replace(/-/g, '_');

const WIKILINK_RE = /\[\[([^\]|#]{1,120})(?:[|#][^\]]*)?\]\]/g;
export function wikilinks(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(WIKILINK_RE)) out.add(m[1].trim());
  return [...out];
}

const ORIGIN_RE = /^\s*originSessionId:\s*["']?([0-9a-f-]{36})/m;
export function originSession(head: string): string | undefined {
  return ORIGIN_RE.exec(head)?.[1];
}

export function buildCanvasGraph(input: GraphInput): CanvasGraph {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (source: string, target: string, kind: CanvasEdgeKind, weight?: number) => {
    if (source === target) return;
    const key = `${source}>${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(weight === undefined ? { source, target, kind } : { source, target, kind, weight: Math.min(1, weight) });
  };

  const byKey = new Map<string, string>();
  for (const c of input.contexts) {
    byKey.set(linkKey(c.id), c.id);
    if (c.name) byKey.set(linkKey(c.name), c.id);
  }
  const ctxIds = new Set(input.contexts.map((c) => c.id));
  const sessionIds = new Set(input.sessions.map((s) => s.meta.id));

  // Built once per graph, not per session: the hub<->leaf vote map only
  // depends on the memory corpus, which is the same for every session below.
  const matchDocs: MatchDoc[] = input.contexts.map((c) => ({ id: c.id, name: c.name, description: c.description, hub: c.id.startsWith('hub_'), links: c.links }));
  const matchTopics = createTopicMatcher(matchDocs);

  for (const { meta, archived } of input.sessions) {
    nodes.push({
      id: sessionNodeId(meta.id), kind: 'session', ref: meta.id,
      title: meta.title, subtitle: (meta.summary || meta.snippet || '').slice(0, 220),
      mtime: meta.mtime, archived: archived || undefined, count: meta.count, waiting: meta.waiting || undefined,
    });
    const refs = input.refs.get(meta.id);
    if (!refs) continue;
    for (const [ctx, kind] of Object.entries(refs.contexts)) {
      if (!ctxIds.has(ctx)) continue;
      // Weight by how many tool calls actually touched this context, when the
      // scanner recorded it (refs.ts's contextHits — absent on an older cache
      // entry, in which case this edge stays unweighted like before). Same cap
      // shape as the topic scorer's own WEIGHT_CAP=5: a context hit 5+ times
      // reads as maximally confident evidence, not linearly unbounded.
      const hits = refs.contextHits?.[ctx];
      addEdge(sessionNodeId(meta.id), contextNodeId(ctx), kind, hits ? hits / 5 : undefined);
    }
    const text = `${meta.title} ${meta.summary ?? ''} ${meta.snippet}`;
    for (const { id: ctx, score } of matchTopics(refs.topics, text)) {
      // A real memory tool call (read/write) is stronger evidence than any
      // inference — never replaced by a topic guess for the same context.
      if (ctxIds.has(ctx) && !refs.contexts[ctx]) addEdge(sessionNodeId(meta.id), contextNodeId(ctx), 'topic', score / 5);
    }
  }

  for (const c of input.contexts) {
    nodes.push({
      id: contextNodeId(c.id), kind: 'context', ref: c.id,
      title: c.title, subtitle: c.description.slice(0, 220), mtime: c.mtime,
      archived: c.archived || undefined, hub: c.id.startsWith('hub_') || undefined, path: c.path,
    });
    if (c.origin && sessionIds.has(c.origin)) addEdge(sessionNodeId(c.origin), contextNodeId(c.id), 'write');
    for (const l of c.links) {
      const target = byKey.get(linkKey(l));
      if (target) addEdge(contextNodeId(c.id), contextNodeId(target), 'link');
    }
  }

  const boundByCard = new Map<string, string[]>();
  for (const [sid, refs] of input.refs) {
    if (!refs.cardId || !sessionIds.has(sid)) continue;
    boundByCard.set(refs.cardId, [...(boundByCard.get(refs.cardId) ?? []), sid]);
  }
  for (const card of input.cards) {
    nodes.push({
      id: cardNodeId(card.id), kind: 'card', ref: card.id,
      title: card.title, subtitle: card.prompt.slice(0, 220), mtime: card.updatedAt, status: card.status,
    });
    for (const ctx of card.contextIds) if (ctxIds.has(ctx)) addEdge(cardNodeId(card.id), contextNodeId(ctx), 'card');
    // Marker-bound sessions (the agent actually ran here) first, as 'card': run
    // state and "open session" should only ever look at these. `card.sessionIds`
    // are the user's prompt INPUT picks, not agent sessions — 'input' kind, and
    // addEdge's dedup means an input pick that happens to already be bound stays
    // 'card' rather than being downgraded.
    for (const sid of boundByCard.get(card.id) ?? []) {
      if (sessionIds.has(sid)) addEdge(cardNodeId(card.id), sessionNodeId(sid), 'card');
    }
    for (const sid of card.sessionIds) {
      if (sessionIds.has(sid)) addEdge(cardNodeId(card.id), sessionNodeId(sid), 'input');
    }
  }

  // Areas by work front, last: needs the full hub/leaf/session edge set above.
  const areas = classifyAreas(nodes, edges);
  for (const n of nodes) { const a = areas.get(n.id); if (a) n.area = a; }

  return { nodes, edges, builtAt: input.now ?? Date.now() };
}
