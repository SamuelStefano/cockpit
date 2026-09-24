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

// A doing card whose sessions all went quiet did NOT reach the server's own
// 'review' status (server/canvas/card-review.ts only moves a card there on a
// CLEAN turn close) — so idle-while-still-doing means the last turn
// stopped/crashed instead, not "looks done" (canvas review 2026-09-24, item
// 6: KanbanCard used to badge this yellow "parece pronto"; it's now red
// "parou sem terminar"). This client-side 'review' is only ever a HINT for
// that badge — the board's real status is untouched until a human confirms.
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

// A 'continue' reuse card useCanvasRoute.ts's runCard already moved to
// "doing", whose send the SERVER refused AFTER the fact (double-writer
// guard, a ctx/size gate that only exists server-side, ...) — #593's
// canvasSendError already correlates the rejection back to the exact
// sessionId+text that caused it; matching a card's own buildContinuePrompt
// output against that text is what tells THIS card apart from an unrelated
// rejection in the same session (review #597 point 5). Never returns a card
// not currently "doing": a manual move or an already-recovered card is not
// this effect's business to touch again.
//
// `err.at >= c.updatedAt` (review #597 follow-up point 1): the caller never
// gets a guaranteed dismiss of `err` (no open terminal ever consumed it can
// leave it sitting in state indefinitely), so without this an OLD rejection
// would keep matching every later run of the SAME card+session+text —
// including a run that then SUCCEEDED — and bounce it back to ToDo with a
// false "recusado" toast. `moveCard` stamps `updatedAt` to `Date.now()` the
// instant a run starts, always strictly before the server's own rejection
// timestamp can arrive, so a genuinely-current rejection always satisfies
// this; a stale one (from a PRIOR attempt, predating the current run) never does.
export function stuckContinueCard(
  cards: CanvasCard[], err: { sessionId: string; text: string; at: number } | null, buildContinuePrompt: (c: CanvasCard) => string,
): CanvasCard | undefined {
  if (!err) return undefined;
  return cards.find((c) => (
    c.status === 'doing' && c.reuse?.mode === 'continue' && c.reuse.sessionId === err.sessionId
    && err.at >= c.updatedAt && buildContinuePrompt(c) === err.text
  ));
}

// CardEditor's draft is a snapshot frozen at open time (useCanvasRoute's
// `draft` state never re-syncs to later board updates). A server-side
// auto-move (card-review.ts: doing→review on a clean turn close) can land
// while the editor is open; if the user never touched the status control
// (edited === original), the LIVE status should win on save instead of being
// clobbered by the stale snapshot. `live` is undefined for a brand-new card.
export function resolveSaveStatus(edited: CanvasCard, original: CanvasCard | undefined, live: CanvasCard | undefined): CardStatus {
  return original && live && edited.status === original.status ? live.status : edited.status;
}

// A doing card can accumulate many bound sessions over retries/follow-ups;
// replaying every historical binding into an open window on every mount or
// reload would flood the canvas and evict windows the user closed on
// purpose. Only a pair not yet in `seen` is "new" and worth auto-opening —
// `seen` is mutated in place (every considered pair is marked, whether new
// or not) so the caller's persisted baseline grows monotonically and a given
// binding is only ever acted on once.
export function newlyBoundSessions(cards: CanvasCard[], edges: CanvasEdge[], seen: Set<string>): { cardId: string; sessionId: string }[] {
  const out: { cardId: string; sessionId: string }[] = [];
  for (const c of cards) {
    if (c.status !== 'doing') continue;
    for (const sessionId of boundSessions(edges, c.id)) {
      const key = `${c.id}:${sessionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ cardId: c.id, sessionId });
    }
  }
  return out;
}

export const MAX_PERSISTED_IDS = 200;

// A localStorage-backed id list (seen card→session bindings, dismissed ghost
// banners) only ever grows — cap it to the most recently added, so a canvas
// with months of history doesn't bloat localStorage forever. Ids are always
// appended, never reordered, so "last N" IS "most recent".
export function capRecent(ids: string[], max = MAX_PERSISTED_IDS): string[] {
  return ids.length > max ? ids.slice(ids.length - max) : ids;
}
