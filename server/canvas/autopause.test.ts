import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  decideAutoPause, emptyAutoPauseMemory, isUnattendedRun, MIN_STOP_GAP_MS, MIN_TURN_AGE_MS, OVER_HYSTERESIS_MS,
  type RunOrigin, type StopCandidate,
} from './autopause';
import { setMarathon, __resetMarathonCache } from '../ws/marathon';

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
    process.env.COCKPIT_MARATHON = join(mkdtempSync(join(tmpdir(), 'autopause-')), 'marathon.json');
    __resetMarathonCache();
  });

  const run = (over: Partial<RunOrigin> = {}): RunOrigin => ({ key: 's1', sessionId: 's1', prompt: 'oi', hasWs: true, parked: false, ...over });

  it('the user\'s own attended chat is NEVER a candidate', () => {
    expect(isUnattendedRun(run())).toBe(false);
  });

  it('a cron-keyed run is unattended', () => {
    expect(isUnattendedRun(run({ key: 'cron-abc', hasWs: false }))).toBe(true);
  });

  it('a marathon-marked session is unattended even with a socket attached', () => {
    setMarathon('s1', true);
    expect(isUnattendedRun(run({ hasWs: true }))).toBe(true);
  });

  it('a run drained from the parked queue is unattended', () => {
    expect(isUnattendedRun(run({ parked: true, hasWs: false }))).toBe(true);
  });

  it('a flow-marked prompt is unattended (forward-compat with PR #592)', () => {
    expect(isUnattendedRun(run({ prompt: 'faz isso [deck-flow:abc-1]', hasWs: false }))).toBe(true);
  });

  it('any run with no live socket is unattended, even without another marker', () => {
    expect(isUnattendedRun(run({ hasWs: false }))).toBe(true);
  });

  it('a marathon flag on the resolved sessionId (not just the key) still counts', () => {
    setMarathon('real-uuid', true);
    expect(isUnattendedRun(run({ key: 'new-xyz', sessionId: 'real-uuid', hasWs: true }))).toBe(true);
  });
});
