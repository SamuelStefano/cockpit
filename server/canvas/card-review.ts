import type { CardStatus } from '../../shared/canvas';
import { broadcast } from '../ws/broadcast';
import { onTurnClosed, type TurnClosed } from './turn-hooks';
import { readBoardChained, updateBoard } from './board';
import { bindCardSession, cardIdForSession, lastCardMarker } from './card-sessions';
import { cardIdFromRefsCache } from './index';

// A card's launched agent moves itself from "doing" to "review" the instant a
// clean turn on its session closes — even with the browser closed, riding the
// same onTurnClosed hook runs.ts fires for the AI summary (and server/canvas/
// flows.ts's chaining). Registered once at import time; see server/index.ts
// and server/agent.ts (both reach server/ws/dispatch.ts, but the side-effect
// import lives directly on both entry points so registration doesn't depend
// on dispatch.ts's own import graph ever changing).
//
// `turn.ok` is `isCleanTurnClose` applied AT THE SOURCE (server/ws/runs.ts) —
// this listener just reads it as given.

// The card a turn belongs to: its OWN prompt if this is a launch turn (or a
// priority-interrupt carrying a fresh marker), else the session's bound
// card — a FOLLOW-UP turn's prompt is just the user's next message, it never
// carries the original `[deck-card:]` marker, so without this a multi-turn
// card would never reach "review". `cardIdForSession` is in-memory
// (process-lifetime); `cardIdFromRefsCache` is the durable disk fallback
// (transcript-scanned refs cache) for a session bound before the last
// restart — same two-step lookup server/canvas/flows.ts uses.
export async function resolveTurnCardId(turn: Pick<TurnClosed, 'prompt' | 'sessionId'>): Promise<string | undefined> {
  const marker = lastCardMarker(turn.prompt);
  if (marker) return marker;
  if (!turn.sessionId) return undefined;
  const bound = cardIdForSession(turn.sessionId);
  if (bound) return bound;
  const fromDisk = await cardIdFromRefsCache(turn.sessionId);
  if (fromDisk) bindCardSession(turn.sessionId, fromDisk); // warm the in-memory map for next time
  return fromDisk;
}

// Pure decision, unit-tested without touching the board file or the socket
// layer: a stopped/failed turn, a turn with no resolvable card, or a card no
// longer in "doing" (moved by hand, or already reviewed by an earlier turn)
// is a no-op. The board stays the source of truth — this never second-guesses
// a manual move.
export function shouldMoveToReview(ok: boolean, cardId: string | undefined, cardStatus: CardStatus | undefined): string | undefined {
  return ok && cardId && cardStatus === 'doing' ? cardId : undefined;
}

onTurnClosed((turn) => {
  // Remember the binding regardless of ok/status — a stopped or questioned
  // launch turn still marks the session as belonging to this card, and a
  // LATER successful follow-up turn needs to find it.
  const markerId = lastCardMarker(turn.prompt);
  if (markerId && turn.sessionId) bindCardSession(turn.sessionId, markerId);
  // Nothing can ever move on a turn that didn't finish cleanly
  // (shouldMoveToReview always says no) — skip the card lookup (an async
  // disk read on an in-memory miss, cardIdFromRefsCache) and the board read
  // entirely rather than doing that work just to throw it away.
  if (!turn.ok) return;

  void (async () => {
    const cardId = await resolveTurnCardId(turn);
    if (!cardId) return;

    // Cheap pre-check so a turn with nothing to do never touches the board
    // file — updateBoard always writes to disk even when its own callback
    // returns the board unchanged, and the vast majority of turn closes
    // aren't a doing card's. The re-check inside updateBoard below is the
    // actual (race-safe) gate; this is purely an optimization.
    const before = (await readBoardChained()).cards.find((c) => c.id === cardId);
    if (shouldMoveToReview(turn.ok, cardId, before?.status) !== cardId) return;

    let moved = false;
    const board = await updateBoard((b) => {
      const card = b.cards.find((c) => c.id === cardId);
      if (shouldMoveToReview(turn.ok, cardId, card?.status) !== cardId) return b;
      moved = true;
      return { ...b, cards: b.cards.map((c) => (c.id === cardId ? { ...c, status: 'review' as const, updatedAt: Date.now() } : c)) };
    });
    const updated = board.cards.find((c) => c.id === cardId);
    if (moved && updated) broadcast({ t: 'canvas-card-status', cardId, status: updated.status });
  })().catch((e) => console.error('card-review: falha ao mover card pra revisão', e));
});
