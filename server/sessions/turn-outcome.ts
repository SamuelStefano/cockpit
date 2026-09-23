import { setTurnOutcome } from '../db';
import { onTurnClosed } from '../canvas/turn-hooks';

// Records the outcome of EVERY closed turn (not just the clean ones — that's
// the whole point) so the sessions list can tell "the agent finished" apart
// from "the turn crashed/stopped/failed" without asking the client to guess
// from a stale graph node. `turn.ok` is server/ws/runs.ts's isCleanTurnClose,
// applied at the source; this listener just persists it, same side-effect-
// import pattern as server/canvas/card-review.ts (registered once, imported
// for effect on both entry points — see server/index.ts and server/agent.ts).
onTurnClosed((turn) => {
  if (!turn.sessionId) return;
  setTurnOutcome(turn.sessionId, turn.ok, Date.now());
});
