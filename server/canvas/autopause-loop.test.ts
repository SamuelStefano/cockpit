import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CanvasBoard, CanvasGraph, TermStats } from '../../shared/canvas';
import { waitForPendingReadForTest, writeAreaAdmissionFile, type LastAreaEntry } from './area-admission';
import {
  LAST_AREA_OF_KEY_MAX, LAST_AREA_OF_KEY_STALE_MS, getAreaOf, isAreaAdmissionBlocked, pruneLastAreaOfKey,
  resetAreaCacheForTest, resetAutoPauseMemoryForTest, resetTickInFlightForTest, runAutoPauseTick,
  updateAreaCacheFromGraph, type AutoPauseRun, type AutoPauseTickDeps,
} from './autopause-loop';
import { newCpuSamples } from './term-stats';

const S1 = '11111111-1111-1111-1111-111111111111';
const S2 = '22222222-2222-2222-2222-222222222222';
const NOW = 10_000_000;

function run(over: Partial<AutoPauseRun> = {}): AutoPauseRun {
  return { key: over.sessionId ?? S1, sessionId: S1, pid: 1, startedAt: NOW - 120_000, prompt: 'cron job', parked: false, ...over };
}

function deps(opts: {
  board: CanvasBoard;
  graph?: CanvasGraph;
  stats?: Record<string, TermStats>;
  runs?: AutoPauseRun[];
  now?: number;
  staleThreadStartedAt?: number | null; // null = thread gone
}): AutoPauseTickDeps & { stop: ReturnType<typeof vi.fn>; notify: ReturnType<typeof vi.fn>; buildCanvas: ReturnType<typeof vi.fn> } {
  const runsList = opts.runs ?? [run()];
  return {
    readBoard: vi.fn(async () => opts.board),
    buildCanvas: vi.fn(async () => opts.graph ?? { nodes: [], edges: [], builtAt: 1 }),
    collectTermStats: vi.fn(async () => opts.stats ?? {}),
    runs: () => runsList,
    stop: vi.fn<(sessionId: string, reason: string) => void>(),
    notify: vi.fn<(area: string, sessionId: string, sessionTitle: string, reason: string) => void>(),
    currentStartedAt: (sessionId: string) => {
      if (opts.staleThreadStartedAt !== undefined) return opts.staleThreadStartedAt ?? undefined;
      return runsList.find((r) => r.sessionId === sessionId)?.startedAt;
    },
    now: opts.now ?? NOW,
  };
}

const graphWith = (sessionId: string, area: 'dfl' | 'deck', title = 't'): CanvasGraph => ({
  nodes: [{ id: `s:${sessionId}`, kind: 'session', ref: sessionId, title, subtitle: '', mtime: 1, area }],
  edges: [], builtAt: 1,
});

const stat = (extra: Partial<TermStats> = {}): TermStats => ({ cpu: 0, rssMb: 0, procs: 1, ...extra });

beforeEach(() => {
  resetAutoPauseMemoryForTest();
  resetAreaCacheForTest();
  resetTickInFlightForTest();
});

describe('runAutoPauseTick', () => {
  it('does nothing when no area has autoPause on — never touches the graph or proc stats', async () => {
    const d = deps({ board: { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10 } }, sessionStatus: {}, hiddenSessions: [] } }); // set but autoPause not true
    await runAutoPauseTick(d);
    expect(d.buildCanvas).not.toHaveBeenCalled();
    expect(d.stop).not.toHaveBeenCalled();
  });

  it('does not stop the first tick an area goes over (hysteresis not yet elapsed)', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const d = deps({ board, graph: graphWith(S1, 'dfl'), stats: { [S1]: stat({ cpu: 90 }) } });
    await runAutoPauseTick(d);
    expect(d.stop).not.toHaveBeenCalled();
  });

  it('stops the offending UNATTENDED session once the area has stayed over long enough, and names it in the notify', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl', 'sessão pesada');
    const stats = { [S1]: stat({ cpu: 90 }) };
    const runs = [run({ key: `cron-x`, prompt: '' })]; // cron = unattended

    await runAutoPauseTick(deps({ board, graph, stats, runs, now: NOW })); // primes overSince at NOW
    const d2 = deps({ board, graph, stats, runs, now: NOW + 35_000 }); // past the 30s hysteresis
    await runAutoPauseTick(d2);
    expect(d2.stop).toHaveBeenCalledWith(S1, expect.stringContaining('cpu'));
    expect(d2.notify).toHaveBeenCalledWith('dfl', S1, 'sessão pesada', expect.stringContaining('cpu'));
  });

  it('NEVER stops an attended run (a live user chat), even once the area is way over budget', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 90 }) };
    // Not a cron, not marathon, not parked, no flow marker/flowHop — this is
    // literally someone typing in their own chat right now.
    const runs = [run({ prompt: 'me ajuda com isso' })];

    await runAutoPauseTick(deps({ board, graph, stats, runs, now: NOW }));
    const d2 = deps({ board, graph, stats, runs, now: NOW + 35_000 });
    await runAutoPauseTick(d2);
    expect(d2.stop).not.toHaveBeenCalled();
  });

  it('a parked-queue-drained run IS a valid candidate (passively drained, not forced via run-now)', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 90 }) };
    const runs = [run({ parked: true })];
    await runAutoPauseTick(deps({ board, graph, stats, runs, now: NOW }));
    const d2 = deps({ board, graph, stats, runs, now: NOW + 35_000 });
    await runAutoPauseTick(d2);
    expect(d2.stop).toHaveBeenCalledWith(S1, expect.any(String));
  });

  it('never stops a session whose turn just started, even if its area is way over', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 90 }) };
    const youngRuns = [run({ startedAt: NOW - 1000 })]; // 1s old

    await runAutoPauseTick(deps({ board, graph, stats, runs: youngRuns, now: NOW }));
    const d2 = deps({ board, graph, stats, runs: youngRuns, now: NOW + 35_000 });
    await runAutoPauseTick(d2);
    expect(d2.stop).not.toHaveBeenCalled();
  });

  it('a session under budget is left alone', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 100, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 5 }) };
    const d = deps({ board, graph, stats, now: NOW + 35_000 });
    await runAutoPauseTick(d);
    expect(d.stop).not.toHaveBeenCalled();
  });

  it('skips the stop when the candidate thread is stale (restarted or closed since the snapshot)', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 90 }) };
    const runs = [run()];
    await runAutoPauseTick(deps({ board, graph, stats, runs, now: NOW }));
    // Thread moved on: currentStartedAt now returns something else entirely.
    const d2 = deps({ board, graph, stats, runs, now: NOW + 35_000, staleThreadStartedAt: NOW + 1 });
    await runAutoPauseTick(d2);
    expect(d2.stop).not.toHaveBeenCalled();
  });

  it('skips the stop when the candidate thread is gone entirely', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 90 }) };
    const runs = [run()];
    await runAutoPauseTick(deps({ board, graph, stats, runs, now: NOW }));
    const d2 = deps({ board, graph, stats, runs, now: NOW + 35_000, staleThreadStartedAt: null });
    await runAutoPauseTick(d2);
    expect(d2.stop).not.toHaveBeenCalled();
  });

  it('does not run two ticks concurrently — a slow tick blocks the next one, which becomes a no-op', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    let releaseFirst!: () => void;
    const gate = new Promise<void>((res) => { releaseFirst = res; });
    const d1 = deps({ board, graph: graphWith(S1, 'dfl'), runs: [] });
    vi.mocked(d1.readBoard).mockImplementation(async () => { await gate; return board; });
    const first = runAutoPauseTick(d1); // not awaited yet — still in flight

    const d2 = deps({ board, graph: graphWith(S1, 'dfl'), runs: [] });
    await runAutoPauseTick(d2); // must return immediately without calling anything
    expect(d2.readBoard).not.toHaveBeenCalled();

    releaseFirst();
    await first;
  });

  it('resets overSince on the early-return path when autoPause has no areas — re-enabling later starts a fresh hysteresis window', async () => {
    const boardOn: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const boardOff: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: false } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 90 }) };
    const runs = [run()];

    // Goes over at NOW.
    await runAutoPauseTick(deps({ board: boardOn, graph, stats, runs, now: NOW }));
    // Toggled off for a while (early-return path) — long enough that, without a
    // reset, the ORIGINAL overSince would already be past the hysteresis window.
    await runAutoPauseTick(deps({ board: boardOff, runs: [], now: NOW + 40_000 }));
    // Toggled back on: if overSince had leaked, this tick would stop immediately
    // (40s+ already "elapsed"). It must NOT — the window only just restarted.
    const d3 = deps({ board: boardOn, graph, stats, runs, now: NOW + 41_000 });
    await runAutoPauseTick(d3);
    expect(d3.stop).not.toHaveBeenCalled();
  });

  it('resets overSince on the early-return path when no sessions are running', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 90 }) };
    const runs = [run()];
    await runAutoPauseTick(deps({ board, graph, stats, runs, now: NOW }));
    await runAutoPauseTick(deps({ board, runs: [], now: NOW + 40_000 })); // nobody running: early return
    const d3 = deps({ board, graph, stats, runs, now: NOW + 41_000 });
    await runAutoPauseTick(d3);
    expect(d3.stop).not.toHaveBeenCalled();
  });
});

// Review of #599: the loop used to write the cross-process admission file
// unconditionally on EVERY tick (10s, forever), even with autopause never
// triggered. These exercise the write-skip directly against a real file.
describe('syncAdmissionState — writes the cross-process file only when needed', () => {
  const prevEnv = process.env.COCKPIT_CANVAS_AREA_ADMISSION;
  let admissionFile: string;
  beforeEach(() => {
    admissionFile = join(mkdtempSync(join(tmpdir(), 'canvas-area-admission-')), 'state.json');
    process.env.COCKPIT_CANVAS_AREA_ADMISSION = admissionFile;
  });
  // `process.env.X = undefined` stringifies to the literal "undefined" (env
  // vars are always strings) — that used to write a real file named
  // `undefined` at the repo root the NEXT time area-admission.ts resolved its
  // path (its `?? default` never triggers once the var is "set" to that
  // string). `delete` is the only way to truly unset it.
  afterEach(() => {
    if (prevEnv === undefined) delete process.env.COCKPIT_CANVAS_AREA_ADMISSION;
    else process.env.COCKPIT_CANVAS_AREA_ADMISSION = prevEnv;
  });

  it('never writes across ticks when nothing is running (nothing blocked, key map never touched)', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    await runAutoPauseTick(deps({ board, runs: [], now: NOW }));
    await expect(readFile(admissionFile, 'utf8')).rejects.toThrow();
    await runAutoPauseTick(deps({ board, runs: [], now: NOW + 20_000 }));
    await expect(readFile(admissionFile, 'utf8')).rejects.toThrow();
  });

  it('writes once an area goes over budget', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 90 }) };
    await runAutoPauseTick(deps({ board, graph, stats, runs: [run()], now: NOW }));
    const written = JSON.parse(await readFile(admissionFile, 'utf8'));
    expect(written.blockedAreas).toEqual(['dfl']);
  });

  it('writes again once the blocked area clears, to actually publish the clear', async () => {
    const overBoard: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const underBoard: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 1000, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    const stats = { [S1]: stat({ cpu: 90 }) };
    const runs = [run()];
    await runAutoPauseTick(deps({ board: overBoard, graph, stats, runs, now: NOW }));
    expect(JSON.parse(await readFile(admissionFile, 'utf8')).blockedAreas).toEqual(['dfl']);
    await runAutoPauseTick(deps({ board: underBoard, graph, stats, runs, now: NOW + 1000 }));
    expect(JSON.parse(await readFile(admissionFile, 'utf8')).blockedAreas).toEqual([]);
  });
});

describe('area cache + admission gate', () => {
  it('isAreaAdmissionBlocked is false for an unknown session (fails open)', () => {
    expect(isAreaAdmissionBlocked(S2)).toBe(false);
    expect(isAreaAdmissionBlocked(undefined)).toBe(false);
  });

  it('a tick over budget blocks admission for that area, and clears it once back under', async () => {
    const board: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 10, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    const graph = graphWith(S1, 'dfl');
    updateAreaCacheFromGraph(graph); // simulate a prior canvas-get populating the cache
    const stats = { [S1]: stat({ cpu: 90 }) };
    const runs = [run()];
    await runAutoPauseTick(deps({ board, graph, stats, runs, now: NOW }));
    expect(isAreaAdmissionBlocked(S1)).toBe(true);

    const under: CanvasBoard = { cards: [], pos: {}, flows: [], budgets: { dfl: { cpu: 1000, autoPause: true } }, sessionStatus: {}, hiddenSessions: [] };
    await runAutoPauseTick(deps({ board: under, graph, stats, runs, now: NOW + 1000 }));
    expect(isAreaAdmissionBlocked(S1)).toBe(false);
  });

  it('updateAreaCacheFromGraph feeds getAreaOf', () => {
    updateAreaCacheFromGraph(graphWith(S1, 'deck'));
    expect(getAreaOf().get(S1)).toBe('deck');
  });

  // Review: server/ws.ts's cron loop and a flow delivered from an index.ts
  // turn run in a DIFFERENT OS process than this loop (agent.ts-only) — they
  // used to read an always-empty blockedAreas Set. This simulates that: a
  // "reader" that never ticks the loop itself, only ever reads the state
  // another process (writeAreaAdmissionFile, direct — bypassing
  // setAreaAdmissionState so isWriter never flips) left on disk.
  it('a process that never ticks the loop still gets blocked after reading another process\'s state off disk', async () => {
    updateAreaCacheFromGraph(graphWith(S1, 'dfl')); // this process's OWN canvas-get populated the session->area map
    await writeAreaAdmissionFile({ blockedAreas: new Set(['dfl']), lastAreaOfKey: new Map() });
    expect(isAreaAdmissionBlocked(S1)).toBe(false); // first call kicks off the (uncached) background read; still stale/empty synchronously
    await waitForPendingReadForTest(); // deterministic: await the EXACT read just triggered, not a guessed sleep (was flaky — review of #599)
    expect(isAreaAdmissionBlocked(S1)).toBe(true); // second call: reads the now-updated in-memory mirror (no new disk hit needed)
  });
});

describe('pruneLastAreaOfKey', () => {
  const entry = (area: LastAreaEntry['area'], at: number): LastAreaEntry => ({ area, at });

  it('drops one-shot `new-<uuid>` keys outright — they never fire twice, pure leak to keep', () => {
    const map = new Map([['new-abc123', entry('deck', 1000)], ['cron-x', entry('deck', 1000)]]);
    const pruned = pruneLastAreaOfKey(map, 1000);
    expect([...pruned.keys()]).toEqual(['cron-x']);
  });

  it('drops a key not refreshed in the last 24h', () => {
    const now = 100_000_000;
    const map = new Map([
      ['cron-fresh', entry('deck', now - 1000)],
      ['cron-dead', entry('deck', now - LAST_AREA_OF_KEY_STALE_MS - 1)],
    ]);
    const pruned = pruneLastAreaOfKey(map, now);
    expect([...pruned.keys()]).toEqual(['cron-fresh']);
  });

  it('keeps a key exactly at the 24h boundary', () => {
    const now = 100_000_000;
    const map = new Map([['cron-x', entry('deck', now - LAST_AREA_OF_KEY_STALE_MS)]]);
    expect([...pruneLastAreaOfKey(map, now).keys()]).toEqual(['cron-x']);
  });

  it('caps at LAST_AREA_OF_KEY_MAX, evicting the OLDEST by `at` (not by insertion/iteration order)', () => {
    const now = 1_000_000;
    const map = new Map<string, LastAreaEntry>();
    // Insert newest-first on purpose — iteration/insertion order must NOT be
    // mistaken for recency order (re-.set on an existing key doesn't reorder
    // a Map, so a naive "drop the first N" would evict the wrong ones here).
    for (let i = 0; i < LAST_AREA_OF_KEY_MAX + 10; i++) map.set(`cron-${i}`, entry('deck', now - i));
    const pruned = pruneLastAreaOfKey(map, now);
    expect(pruned.size).toBe(LAST_AREA_OF_KEY_MAX);
    // The 10 oldest (highest `now - at`, i.e. the LAST 10 inserted here) are gone.
    for (let i = LAST_AREA_OF_KEY_MAX; i < LAST_AREA_OF_KEY_MAX + 10; i++) expect(pruned.has(`cron-${i}`)).toBe(false);
    expect(pruned.has('cron-0')).toBe(true); // the most recent survives
  });
});

// Sanity check that the real term-stats sample store type (used by the real
// tick() wiring) is what collectTermStats expects — a regression here would
// mean the loop and the client poll are back to sharing one map (point 7).
describe('term-stats sample isolation', () => {
  it('newCpuSamples returns an independent store each call', () => {
    const a = newCpuSamples();
    const b = newCpuSamples();
    a.set('s:x', { ticks: 1, at: 1 });
    expect(b.has('s:x')).toBe(false);
  });
});
