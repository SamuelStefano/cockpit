import { FLOW_MARKER_RE, type AreaId } from '../../shared/canvas';
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

export interface RunOrigin {
  key: string;          // sessionKey the thread is stored under (threads.ts)
  sessionId?: string;
  prompt: string;
  // Drained by the passive parked-queue drainer and NOT forced via "run now"/
  // "run in background" (server/ws/threads.ts's Thread.parkedForced) — those
  // are explicit user clicks, not the drainer picking something unattended.
  parked: boolean;
  flowHop?: number;      // Thread.flowHop — set (even 0) when a canvas flow delivered this turn
}

// The ONLY turns autopause may ever stop: nobody is watching them live.
// Deliberately NOT based on "does this run have a live websocket" — ws:null
// also covers a resume offer the user just clicked ("retomar"), an
// auto/orphan resume of the user's own chat, and "run now" forcing an item
// out of the queue: all of those are explicit, attended actions that just
// happen to run through a code path with no socket attached (review #595
// second pass, point 1 — the earlier hasWs-based check wrongly caught all
// three). What actually means "nobody is watching" is one of: a scheduled
// cron, a marathon (explicitly unattended by design), a turn a canvas flow
// chained on its own (FLOW_MARKER_RE on the prompt, or Thread.flowHop set —
// the marker survives on `prompt` but a crash-resume rewrites the prompt to
// RESUME_PROMPT, which is why flowHop exists as a second signal), or an item
// the PASSIVE drainer picked up by itself. The user's own chat — typed by
// hand, in a tab open right now — is never a candidate; over budget there is
// a warning (red chip + toast), never an automatic kill.
export function isUnattendedRun(run: RunOrigin): boolean {
  return run.key.startsWith('cron-')
    || threadIsMarathon(run.key, run.sessionId)
    || run.parked
    || run.flowHop !== undefined
    || FLOW_MARKER_RE.test(run.prompt);
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
