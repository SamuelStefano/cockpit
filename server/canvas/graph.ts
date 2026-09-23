import type { SessionMeta } from '../../shared/protocol';
import {
  type CanvasCard, type CanvasEdge, type CanvasEdgeKind, type CanvasGraph, type CanvasNode,
  cardNodeId, contextNodeId, sessionNodeId,
} from '../../shared/canvas';
import type { SessionRefs } from './refs';
import { createTopicMatcher, type MatchDoc } from './topics';
import { classifyAreas } from './areas';
import { buildConflictEdges, type NoisyPathConfig } from './conflicts';

// Same notion of "active" as the client's canvas-filter (scope=active): a
// session with real signs of life right now, not just "touched sometime this
// week". Duplicated rather than imported — canvas-filter.ts lives under
// src/routes (a client module) and this is server-only.
export const ACTIVE_WINDOW_MS = 48 * 3600_000;
// Mirrors the client's canvas-timeline.ts TIMELINE_WINDOW_MS (same reason for
// the duplication: that module lives under src/routes). Activity older than
// this is trimmed from the payload — the timeline never scrubs past it.
export const TIMELINE_TRIM_MS = 7 * 24 * 3600_000;

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
  running?: Set<string>; // session ids with a live thread right now
  now?: number;
  // Real absolute dirs to exclude from conflict detection. Optional so
  // existing fixtures/tests that never populate `writes` don't need to know
  // about it — defaulted to "" below, which never matches any path.
  memoryDir?: string;
  tmpDir?: string;
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

  const now = input.now ?? Date.now();
  const running = input.running ?? new Set<string>();
  const activeIds = new Set<string>();
  const writesBySession: { id: string; writes: Record<string, number>; activity: [number, number][] }[] = [];
  for (const { meta, archived } of input.sessions) {
    const refs = input.refs.get(meta.id);
    // Trimmed to what the timeline can actually scrub to, and skipped for an
    // archived session entirely — neither the timeline nor a conflict cares
    // about one, so there's no reason to ship its activity payload at all.
    const activity = !archived && refs?.activity?.length
      ? refs.activity.filter(([, end]) => now - end < TIMELINE_TRIM_MS)
      : undefined;
    nodes.push({
      id: sessionNodeId(meta.id), kind: 'session', ref: meta.id,
      title: meta.title, subtitle: (meta.summary || meta.snippet || '').slice(0, 220),
      mtime: meta.mtime, archived: archived || undefined, count: meta.count, waiting: meta.waiting || undefined,
      activity: activity?.length ? activity : undefined,
    });
    if (running.has(meta.id) || meta.waiting || now - meta.mtime < ACTIVE_WINDOW_MS) activeIds.add(meta.id);
    if (!archived && refs?.writes && Object.keys(refs.writes).length) {
      writesBySession.push({ id: meta.id, writes: refs.writes, activity: refs.activity ?? [] });
    }
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

  const noisy: NoisyPathConfig = { memoryDir: input.memoryDir ?? '', tmpDir: input.tmpDir ?? '' };
  for (const e of buildConflictEdges({ sessions: writesBySession, active: activeIds, noisy, now })) {
    const key = `${e.source}>${e.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(e);
  }

  // Areas by work front, last: needs the full hub/leaf/session/conflict edge set above.
  const areas = classifyAreas(nodes, edges);
  for (const n of nodes) { const a = areas.get(n.id); if (a) n.area = a; }

  return { nodes, edges, builtAt: now };
}
