import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RunOrigin, StopCandidate } from './autopause';

// server/ws/marathon.ts freezes its store path in a module-level const the
// FIRST time it's imported — a later `process.env.COCKPIT_MARATHON =`
// reassignment (e.g. inside beforeEach) has no effect on an already-loaded
// module. A static `import` is hoisted above everything else in this file, so
// the env var has to be set, and the module imported dynamically, in that
// order — same pattern server/ws/marathon.test.ts already relies on. Getting
// this wrong doesn't just break isolation BETWEEN this file's own tests, it
// also writes 's1'/'real-uuid' into the box's REAL ~/.cockpit/marathon.json.
const marathonDir = mkdtempSync(join(tmpdir(), 'autopause-marathon-'));
process.env.COCKPIT_MARATHON = join(marathonDir, 'marathon.json');
afterAll(() => rmSync(marathonDir, { recursive: true, force: true }));

const { decideAutoPause, emptyAutoPauseMemory, isUnattendedRun, MIN_STOP_GAP_MS, MIN_TURN_AGE_MS, OVER_HYSTERESIS_MS } = await import('./autopause');
const { setMarathon, marathonKeys, __resetMarathonCache } = await import('../ws/marathon');

const T0 = 1_000_000;
const cand = (id: string, area: 'dfl' | 'deck', startedAt: number, weight = 1): StopCandidate => ({ sessionId: id, area, startedAt, weight });

describe('decideAutoPause', () => {
  it('does nothing the instant an area goes over — hysteresis has not elapsed', () => {
    const r = decideAutoPause(T0, new Set(['dfl']), [cand('a', 'dfl', T0 - MIN_TURN_AGE_MS - 1)], emptyAutoPauseMemory());
    expect(r.stop).toBeUndefined();
    expect(r.mem.overSince.dfl).toBe(T0);
  });

  it('stops once the area has been over for OVER_HYSTERESIS_MS, picking the heaviest eligible candidate', () => {
    let mem = emptyAutoPauseMemory();
    mem = decideAutoPause(T0, new Set(['dfl']), [], mem).mem; // area goes over at T0
    const candidates = [
      cand('light', 'dfl', T0 - MIN_TURN_AGE_MS - 1, 1),
      cand('heavy', 'dfl', T0 - MIN_TURN_AGE_MS - 1, 9),
    ];
    const r = decideAutoPause(T0 + OVER_HYSTERESIS_MS, new Set(['dfl']), candidates, mem);
    expect(r.stop?.sessionId).toBe('heavy');
  });

  it('never stops a turn younger than MIN_TURN_AGE_MS even once hysteresis has elapsed', () => {
    let mem = emptyAutoPauseMemory();
    mem = decideAutoPause(T0, new Set(['dfl']), [], mem).mem;
    const now = T0 + OVER_HYSTERESIS_MS;
    const candidates = [cand('newborn', 'dfl', now - MIN_TURN_AGE_MS + 1)];
    const r = decideAutoPause(now, new Set(['dfl']), candidates, mem);
    expect(r.stop).toBeUndefined();
  });

  it('clears the hysteresis clock once the area is no longer over', () => {
    let mem = emptyAutoPauseMemory();
    mem = decideAutoPause(T0, new Set(['dfl']), [], mem).mem; // over at T0
    mem = decideAutoPause(T0 + 5000, new Set(), [], mem).mem; // clears before 30s
    const now = T0 + 5000 + OVER_HYSTERESIS_MS; // would have been enough from T0, not from the restart
    const r = decideAutoPause(now, new Set(['dfl']), [cand('a', 'dfl', now - MIN_TURN_AGE_MS - 1)], mem);
    expect(r.stop).toBeUndefined();
    expect(r.mem.overSince.dfl).toBe(T0 + 5000 + OVER_HYSTERESIS_MS); // restarted the clock just now
  });

  it('allows at most one stop per area per MIN_STOP_GAP_MS', () => {
    let mem = emptyAutoPauseMemory();
    mem = decideAutoPause(T0, new Set(['dfl']), [], mem).mem;
    const t1 = T0 + OVER_HYSTERESIS_MS;
    const c1: StopCandidate[] = [cand('a', 'dfl', t1 - MIN_TURN_AGE_MS - 1)];
    const first = decideAutoPause(t1, new Set(['dfl']), c1, mem);
    expect(first.stop?.sessionId).toBe('a');
    mem = first.mem;

    // Still over right after the stop, a new (older) candidate exists — but the
    // gap has not elapsed, so no second stop yet.
    const t2 = t1 + 1000;
    const c2: StopCandidate[] = [cand('b', 'dfl', t2 - MIN_TURN_AGE_MS - 1)];
    const second = decideAutoPause(t2, new Set(['dfl']), c2, mem);
    expect(second.stop).toBeUndefined();
    mem = second.mem;

    // Past the gap, a stop is allowed again.
    const t3 = t1 + MIN_STOP_GAP_MS + 1;
    const third = decideAutoPause(t3, new Set(['dfl']), c2, mem);
    expect(third.stop?.sessionId).toBe('b');
  });

  it('stops at most one area per call, even with two areas over at once', () => {
    let mem = emptyAutoPauseMemory();
    mem = decideAutoPause(T0, new Set(['dfl', 'deck']), [], mem).mem;
    const now = T0 + OVER_HYSTERESIS_MS;
    const candidates = [cand('a', 'dfl', now - MIN_TURN_AGE_MS - 1), cand('b', 'deck', now - MIN_TURN_AGE_MS - 1)];
    const r = decideAutoPause(now, new Set(['dfl', 'deck']), candidates, mem);
    expect(r.stop).toBeDefined();
    // Exactly one of the two areas got a stop recorded this round.
    const stopped = Object.keys(r.mem.lastStopAt).filter((a) => r.mem.lastStopAt[a as 'dfl' | 'deck'] === now);
    expect(stopped).toHaveLength(1);
  });

  it('an area over with no eligible candidate (all too young, or none) stops nothing', () => {
    let mem = emptyAutoPauseMemory();
    mem = decideAutoPause(T0, new Set(['dfl']), [], mem).mem;
    const now = T0 + OVER_HYSTERESIS_MS;
    const r = decideAutoPause(now, new Set(['dfl']), [], mem);
    expect(r.stop).toBeUndefined();
  });
});

describe('isUnattendedRun', () => {
  beforeEach(() => {
    for (const k of marathonKeys()) setMarathon(k, false);
    __resetMarathonCache();
  });

  const run = (over: Partial<RunOrigin> = {}): RunOrigin => ({ key: 's1', sessionId: 's1', prompt: 'oi', parked: false, ...over });

  it('the user\'s own attended chat is NEVER a candidate', () => {
    expect(isUnattendedRun(run())).toBe(false);
  });

  it('a cron-keyed run is unattended', () => {
    expect(isUnattendedRun(run({ key: 'cron-abc' }))).toBe(true);
  });

  it('a marathon-marked session is unattended', () => {
    setMarathon('s1', true);
    expect(isUnattendedRun(run())).toBe(true);
  });

  it('a run drained from the parked queue (passively) is unattended', () => {
    expect(isUnattendedRun(run({ parked: true }))).toBe(true);
  });

  it('a flow-marked prompt is unattended', () => {
    expect(isUnattendedRun(run({ prompt: 'faz isso [deck-flow:abc-1:2]' }))).toBe(true);
  });

  it('Thread.flowHop alone (no marker on the prompt — a crash-resume rewrote it) is unattended', () => {
    expect(isUnattendedRun(run({ prompt: 'Continue exatamente de onde parou', flowHop: 2 }))).toBe(true);
  });

  it('flowHop 0 still counts (a real flow-delivered first hop, not "no flow")', () => {
    expect(isUnattendedRun(run({ flowHop: 0 }))).toBe(true);
  });

  it('a marathon flag on the resolved sessionId (not just the key) still counts', () => {
    setMarathon('real-uuid', true);
    expect(isUnattendedRun(run({ key: 'new-xyz', sessionId: 'real-uuid' }))).toBe(true);
  });

  // Review #595 second pass, point 1: these three used to be wrongly caught by
  // the old "no live socket" criterion. All three run with ws:null (a resume/
  // run-now has no browser attached to the spawn call), but every one is an
  // explicit, ATTENDED user action — none may ever be autopause-stopped.
  it('a resume-offer click ("retomar") is NOT stoppable — plain resume, no cron/marathon/parked/flow marker', () => {
    // acceptResumeOffer/autoResume/resumeOrphanRuns all start the SAME shape:
    // ws:null, RESUME_PROMPT, no flowHop, not parked, not a cron/marathon key.
    expect(isUnattendedRun(run({ prompt: 'O turno anterior foi interrompido por uma falha do processo. Continue exatamente de onde parou, sem repetir o trabalho já feito.' }))).toBe(false);
  });

  it('"run now" (queue-force) forcing a parked item out of the queue is NOT stoppable', () => {
    // runParkedNow sets Thread.parked AND Thread.parkedForced — the wiring in
    // autopause-loop.ts's tick() folds that into `parked: false` for this check.
    expect(isUnattendedRun(run({ parked: false }))).toBe(false);
  });

  it('"run in background" is likewise not stoppable (same forced-parked shape)', () => {
    expect(isUnattendedRun(run({ key: 'fork-uuid', sessionId: 'fork-uuid', parked: false }))).toBe(false);
  });
});
