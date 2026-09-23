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
  ok: boolean; // finished on its own with real output: endReason success, not stopped/silent/questioned, no auth/quota burn
  // Chain depth this turn ran at (server/ws/threads.ts Thread.flowHop), carried
  // through resume/orphan-resume/parked-requeue — NOT re-derived from prompt
  // text, which a crash-resume replaces with a markerless RESUME_PROMPT.
  hop: number;
  // cron-* sessions and marathon turns run unattended: nobody is going to see
  // (or approve) whatever a chained flow does next, so listeners that fire
  // further automated work should skip these entirely.
  unattended: boolean;
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
