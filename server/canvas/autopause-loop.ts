import type { AreaId, CanvasGraph } from '../../shared/canvas';
import { areaUsageFromIds, evaluateBudget } from '../../shared/canvas-budget';
import { broadcastAdmin } from '../ws/broadcast';
import { threads, stopSessionForBudget } from '../ws/threads';
import { readBoard } from './board';
import { buildCanvas } from './index';
import { collectTermStats, newCpuSamples, type RunPids } from './term-stats';
import { decideAutoPause, emptyAutoPauseMemory, isUnattendedRun, type AutoPauseMemory, type StopCandidate } from './autopause';

// The budgets popover measures "open terminals" for cpu, but a window being
// open is client-only UI state the server never sees outside of a specific
// canvas-term-stats REQUEST (which carries the caller's own open-ids list —
// see dispatch.ts). The loop has no such request to piggyback on, so every
// RUNNING session's cpu is used as the proxy instead — a session with an
// open-but-idle window contributes ~0 either way, and autopause only ever
// acts on a session that IS running, so the two can't disagree on a case that
// would produce a stop. shared/canvas-budget.ts's areaUsageFromIds is the same
// function the canvas-term-stats reply uses, just with cpuIds=runningIds here.
const TICK_MS = 10_000;
const SESSION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let mem: AutoPauseMemory = emptyAutoPauseMemory();
let started = false;
// A slow tick (buildCanvas rebuilding the whole graph) must not overlap the
// next timer fire — two concurrent ticks could both decide to stop the SAME
// candidate, or double-count usage from two in-flight collectTermStats calls.
let tickInFlight = false;
const loopSamples = newCpuSamples();

// --- session -> area/title cache --------------------------------------------
// Rebuilding the whole memory graph (transcript scans, memory-dir reads) on
// every 10s tick would be real, mostly-wasted work — refresh for free off the
// SAME buildCanvas() result the canvas-get handler already computed
// (updateAreaCacheFromGraph), and otherwise at most every AREA_CACHE_TTL_MS.
const AREA_CACHE_TTL_MS = 5 * 60_000;
interface AreaCacheEntry { area: AreaId; title: string }
let areaCache = new Map<string, AreaCacheEntry>();
let areaCacheAt = 0;
// Areas currently over budget WITH autopause on, as of the last tick — read by
// runs.ts's drainParked/fireCron to gate ADMISSION of new unattended work
// instead of racing autopause's own stop→drain→stop loop.
let blockedAreas = new Set<AreaId>();

export function updateAreaCacheFromGraph(graph: CanvasGraph): void {
  const next = new Map<string, AreaCacheEntry>();
  for (const n of graph.nodes) if (n.kind === 'session' && n.area) next.set(n.ref, { area: n.area, title: n.title });
  areaCache = next;
  areaCacheAt = Date.now();
}

async function ensureAreaCache(build: () => Promise<CanvasGraph>): Promise<Map<string, AreaCacheEntry>> {
  if (areaCache.size && Date.now() - areaCacheAt < AREA_CACHE_TTL_MS) return areaCache;
  updateAreaCacheFromGraph(await build());
  return areaCache;
}

// Sync + cheap on purpose: called from the hot path of every parked-queue
// drain / cron fire, never triggers a rebuild. Unknown session (not yet in the
// cache, or a cron with no resumeId to classify at all) fails OPEN — admitted.
export function isAreaAdmissionBlocked(sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  const entry = areaCache.get(sessionId);
  return !!entry && blockedAreas.has(entry.area);
}

// Read by the canvas-term-stats dispatch handler to compute the SAME
// per-area usage number the loop itself acts on (shared/canvas-budget.ts's
// areaUsageFromIds), instead of the client guessing its own.
export function getAreaOf(): ReadonlyMap<string, AreaId> {
  const out = new Map<string, AreaId>();
  for (const [sid, entry] of areaCache) out.set(sid, entry.area);
  return out;
}

export function startAutoPauseLoop(): void {
  if (started) return;
  started = true;
  setInterval(tick, TICK_MS).unref();
}

// Test-only resets: module-level state has to persist between REAL ticks, which
// would otherwise leak between tests (hysteresis timers, cached areas, the
// in-flight flag if a test throws mid-tick).
export function resetAutoPauseMemoryForTest(): void { mem = emptyAutoPauseMemory(); }
export function resetAreaCacheForTest(): void { areaCache = new Map(); areaCacheAt = 0; blockedAreas = new Set(); }
export function resetTickInFlightForTest(): void { tickInFlight = false; }

export interface AutoPauseRun extends RunPids {
  prompt: string;
  hasWs: boolean;
  parked: boolean;
}

export interface AutoPauseTickDeps {
  readBoard: typeof readBoard;
  buildCanvas: () => Promise<CanvasGraph>;
  collectTermStats: typeof collectTermStats;
  runs: () => AutoPauseRun[];
  stop: (sessionId: string, reason: string) => void;
  notify: (area: AreaId, sessionId: string, sessionTitle: string, reason: string) => void;
  // Re-check right before acting: `runs()` is a snapshot taken before the
  // awaits below (buildCanvas/collectTermStats), so the candidate's thread may
  // have restarted (new turn, same sessionId) or closed on its own since.
  currentStartedAt: (sessionId: string) => number | undefined;
  now?: number;
}

// Exported for tests: one tick end to end against injectable collaborators, so
// the wiring (not just decideAutoPause) has coverage without touching /proc,
// tmux or a real thread map.
export async function runAutoPauseTick(deps: AutoPauseTickDeps): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    await runTick(deps);
  } finally {
    tickInFlight = false;
  }
}

// Both early-return paths still run every area through decideAutoPause with an
// EMPTY over-set (instead of a bare `return`), so a stale overSince — left over
// from an area that was over budget and has since cleared, or from autopause
// being toggled OFF for it — is actually reset. A `return` here used to leave
// `mem` untouched forever until the next tick that reached the normal path,
// which meant re-enabling autopause on a since-cleared area could reuse an
// ancient overSince and fire a stop before ever observing 30s over in THIS
// episode.
function clearOverBudget(now: number): void {
  mem = decideAutoPause(now, new Set(), [], mem).mem;
  blockedAreas = new Set();
}

async function runTick(deps: AutoPauseTickDeps): Promise<void> {
  const now = deps.now ?? Date.now();
  const board = await deps.readBoard();
  const autoPauseAreas = (Object.keys(board.budgets) as AreaId[]).filter((a) => board.budgets[a]?.autoPause);
  if (!autoPauseAreas.length) { clearOverBudget(now); return; } // cheap file read only — no graph/proc scan when nobody opted in

  const runs = deps.runs();
  const sessionIds = [...new Set(runs.map((r) => r.sessionId).filter((s): s is string => !!s && SESSION_UUID_RE.test(s)))];
  if (!sessionIds.length) { clearOverBudget(now); return; }

  const areaMap = await ensureAreaCache(deps.buildCanvas);
  const areaOf = new Map<string, AreaId>();
  for (const [sid, entry] of areaMap) areaOf.set(sid, entry.area);

  const stats = await deps.collectTermStats(sessionIds, [], runs, loopSamples);
  const usage = areaUsageFromIds(areaOf, sessionIds, new Set(sessionIds), stats);

  const overAreas = new Set<AreaId>();
  const overKind = new Map<AreaId, 'cpu' | 'ctx'>();
  for (const area of autoPauseAreas) {
    const status = evaluateBudget(usage[area], board.budgets[area]);
    if (status.overCpu || status.overCtx) { overAreas.add(area); overKind.set(area, status.overCpu ? 'cpu' : 'ctx'); }
  }
  blockedAreas = overAreas;
  if (!overAreas.size) { mem = decideAutoPause(now, overAreas, [], mem).mem; return; }

  const candidates: StopCandidate[] = [];
  for (const r of runs) {
    if (!r.sessionId || !SESSION_UUID_RE.test(r.sessionId)) continue;
    const area = areaOf.get(r.sessionId);
    if (!area || !overAreas.has(area)) continue;
    // The user's own attended chat is NEVER stoppable, no matter how over
    // budget its area is — only a turn nobody is watching live can be a
    // candidate (cron, marathon, parked-drain, flow-triggered, no live ws).
    if (!isUnattendedRun(r)) continue;
    const s = stats[r.sessionId];
    if (!s) continue;
    const weight = overKind.get(area) === 'cpu' ? s.cpu : (s.contextTokens ?? 0);
    candidates.push({ sessionId: r.sessionId, area, startedAt: r.startedAt, weight });
  }

  const decision = decideAutoPause(now, overAreas, candidates, mem);
  mem = decision.mem;
  if (!decision.stop) return;
  const { sessionId, area, startedAt } = decision.stop;
  if (deps.currentStartedAt(sessionId) !== startedAt) return; // stale: the thread moved on since `runs()` was snapshotted
  const status = evaluateBudget(usage[area], board.budgets[area]);
  const reason = status.reasons.join('; ') || 'orçamento excedido';
  const title = areaMap.get(sessionId)?.title ?? sessionId;
  deps.stop(sessionId, reason);
  deps.notify(area, sessionId, title, reason);
}

function tick(): void {
  runAutoPauseTick({
    readBoard,
    buildCanvas,
    collectTermStats,
    runs: () => [...threads].map(([key, t]) => ({
      key, sessionId: t.sessionId, pid: t.handle.pid, startedAt: t.startedAt,
      prompt: t.prompt, hasWs: !!t.hasWs, parked: !!t.parked,
    })),
    stop: stopSessionForBudget,
    notify: (area, sessionId, sessionTitle, reason) => {
      console.log(`[canvas-autopause] parou "${sessionTitle}" (${sessionId}) na área ${area}: ${reason}`);
      // Canvas data (session titles) never goes to a non-admin socket — same
      // rule as every other canvas-* frame (dispatch.ts).
      broadcastAdmin({ t: 'canvas-budget-paused', area, sessionId, sessionTitle, reason });
    },
    currentStartedAt: (sessionId) => {
      for (const t of threads.values()) if (t.sessionId === sessionId) return t.startedAt;
      return undefined;
    },
  }).catch((err) => console.error('[canvas-autopause] tick falhou:', err));
}
