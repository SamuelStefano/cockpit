import type { RunParams } from '../ws/threads';

// One seam where canvas features react to a Deck turn closing (flows that chain
// sessions, cards that move to review). runs.ts calls it once per close and
// stays ignorant of who listens; listeners register at import time.

export interface TurnClosed {
  sessionKey: string;
  sessionId?: string;
  prompt: string; // the prompt that started this turn (carries [deck-card:…] / flow markers)
  text: string; // the assistant's final text for the turn
  params: RunParams;
  ok: boolean; // finished on its own with output: not stopped, not a silent death, not waiting on a question
}

type Listener = (t: TurnClosed) => void;
const listeners = new Set<Listener>();

export function onTurnClosed(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// A listener that throws must never break the close path of the run.
export function emitTurnClosed(t: TurnClosed): void {
  for (const fn of listeners) {
    try { fn(t); } catch (e) { console.error('turn-closed listener', e); }
  }
}
