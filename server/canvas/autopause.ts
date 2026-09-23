import type { AreaId } from '../../shared/canvas';
import { threadIsMarathon } from '../ws/marathon';

// Pure decision: given which areas are currently over their budget and who
// could be stopped, decide AT MOST ONE stop per call — conservatively, with
// three guards the brief calls out explicitly:
//   1. hysteresis: an area must stay over for OVER_HYSTERESIS_MS continuously
//      before it counts (a CPU spike that clears in 10s must not trigger).
//   2. never stop a turn younger than MIN_TURN_AGE_MS (a turn that just
//      started hasn't had a chance to do anything yet).
//   3. at most one stop per area per MIN_STOP_GAP_MS (stopping repeatedly
//      the instant the next-heaviest turn also crosses the line would just
//      empty the area — this is a brake, not a kill switch).
// The loop (autopause-loop.ts) is the only caller; kept separate so the
// hysteresis logic is testable without a live process tree or a real thread.

export const OVER_HYSTERESIS_MS = 30_000;
export const MIN_TURN_AGE_MS = 60_000;
export const MIN_STOP_GAP_MS = 120_000;

export interface StopCandidate {
  sessionId: string;
  area: AreaId;
  startedAt: number;
  weight: number; // whichever metric put the area over (cpu or ctxTokens) — higher stops first
}

// Marks a turn started by server/canvas/flows.ts (PR #592, orchestrator flows —
// not merged into this branch yet). Kept local rather than in shared/canvas.ts:
// verify this literally matches flows.ts's own marker at rebase time, the same
// way CARD_MARKER_RE in shared/canvas.ts anchors card-launched turns. A no-op
// (never matches) until that PR lands.
const FLOW_MARKER_RE = /\[deck-flow:[a-z0-9-]{1,40}\]/;

export interface RunOrigin {
  key: string;          // sessionKey the thread is stored under (threads.ts)
  sessionId?: string;
  prompt: string;
  hasWs: boolean;        // a live client socket started this run (StartRunOptions.ws)
  parked: boolean;       // this run is currently draining a parked-queue item (thread.parked)
}

// The ONLY turns autopause may ever stop: nobody is watching them live. The
// user's own chat — typed by hand, in a tab that's open right now — is NEVER a
// candidate, no matter how over budget its area is; over-budget there is a
// warning (red chip + toast), never an automatic kill. This mirrors the same
// "unattended" concept runs.ts already uses to skip a post-turn summary call.
export function isUnattendedRun(run: RunOrigin): boolean {
  return run.key.startsWith('cron-')
    || threadIsMarathon(run.key, run.sessionId)
    || run.parked
    || FLOW_MARKER_RE.test(run.prompt)
    || !run.hasWs;
}

export interface AutoPauseMemory {
  overSince: Partial<Record<AreaId, number>>;
  lastStopAt: Partial<Record<AreaId, number>>;
}

export function emptyAutoPauseMemory(): AutoPauseMemory {
  return { overSince: {}, lastStopAt: {} };
}

export interface AutoPauseDecision {
  stop?: StopCandidate;
  mem: AutoPauseMemory;
}

export function decideAutoPause(
  now: number,
  overAreas: ReadonlySet<AreaId>,
  candidates: readonly StopCandidate[],
  mem: AutoPauseMemory,
): AutoPauseDecision {
  const overSince: Partial<Record<AreaId, number>> = {};
  for (const area of overAreas) overSince[area] = mem.overSince[area] ?? now;

  for (const area of overAreas) {
    const since = overSince[area]!;
    if (now - since < OVER_HYSTERESIS_MS) continue;
    const last = mem.lastStopAt[area];
    if (last !== undefined && now - last < MIN_STOP_GAP_MS) continue;
    const pool = candidates.filter((c) => c.area === area && now - c.startedAt >= MIN_TURN_AGE_MS);
    if (!pool.length) continue;
    const heaviest = [...pool].sort((a, b) => b.weight - a.weight || a.sessionId.localeCompare(b.sessionId))[0];
    return { stop: heaviest, mem: { overSince, lastStopAt: { ...mem.lastStopAt, [area]: now } } };
  }
  return { mem: { overSince, lastStopAt: mem.lastStopAt } };
}
