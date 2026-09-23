import {
  type CanvasCard, type CanvasEdge, type CanvasGraph, type CanvasNode, type CardStatus,
  cardNodeId, contextNodeId, sessionNodeId,
} from '../../../shared/canvas';

// The board is the source of truth for cards (title, status, links); the graph
// frame may lag one rebuild behind a save, so card nodes and their context/session
// edges are re-derived from the board. Only marker-bound session edges come from
// the server, because only it reads transcripts.
export function mergeBoard(graph: CanvasGraph | null, cards: CanvasCard[]): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const base = graph ?? { nodes: [], edges: [], builtAt: 0 };
  const cardIds = new Set(cards.map((c) => cardNodeId(c.id)));
  const nodes = base.nodes.filter((n) => n.kind !== 'card');
  const known = new Set(nodes.map((n) => n.id));
  const edges = base.edges.filter((e) => !e.source.startsWith('k:') || (cardIds.has(e.source) && e.target.startsWith('s:')));
  const seen = new Set(edges.map((e) => `${e.source}>${e.target}`));
  for (const c of cards) {
    const id = cardNodeId(c.id);
    nodes.push({ id, kind: 'card', ref: c.id, title: c.title, subtitle: c.prompt.slice(0, 220), mtime: c.updatedAt, status: c.status });
    const add = (target: string, kind: 'card' | 'input') => {
      const key = `${id}>${target}`;
      if (!known.has(target) || seen.has(key)) return;
      seen.add(key);
      edges.push({ source: id, target, kind });
    };
    // Contexts and marker-bound sessions (already in `edges`, filtered in from
    // the graph above) are 'card'; `sessionIds` are the user's prompt INPUT
    // picks, not agent sessions — see server/canvas/graph.ts for the same split.
    for (const target of c.contextIds.map(contextNodeId)) add(target, 'card');
    for (const target of c.sessionIds.map(sessionNodeId)) add(target, 'input');
  }
  return { nodes, edges };
}

export type CardRun = 'idle' | 'running' | 'review';

// Only a marker-bound ('card') edge means the agent actually ran on that
// session — an 'input' edge is just a prompt-context pick and would otherwise
// make an idle input session look like it is running, or "sessões ↗" open the
// wrong chat (canvas review #4).
export function boundSessions(edges: CanvasEdge[], cardId: string): string[] {
  const id = cardNodeId(cardId);
  return edges.filter((e) => e.source === id && e.kind === 'card' && e.target.startsWith('s:')).map((e) => e.target.slice(2));
}

// A doing card whose sessions all went quiet is waiting on the human, which is
// exactly what the review column means; the board only suggests the move.
export function cardRun(card: CanvasCard, sessions: string[], running: Set<string>): CardRun {
  if (sessions.some((s) => running.has(s))) return 'running';
  if (card.status === 'doing' && sessions.length) return 'review';
  return 'idle';
}

export function newCardId(now: number, rand: number): string {
  return `${now.toString(36)}-${Math.floor(rand * 36 ** 4).toString(36).padStart(4, '0')}`;
}

export function newFlowId(now: number, rand: number): string {
  return `f-${now.toString(36)}-${Math.floor(rand * 36 ** 4).toString(36).padStart(4, '0')}`;
}

export function moveCard(card: CanvasCard, status: CardStatus, now: number): CanvasCard {
  return { ...card, status, updatedAt: now };
}
