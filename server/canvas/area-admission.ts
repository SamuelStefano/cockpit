import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { AreaId } from '../../shared/canvas';

// Cross-process bridge for canvas autopause admission gating.
//
// server/canvas/autopause-loop.ts's tick only runs in the AGENT process
// (server/agent.ts calls startAutoPauseLoop; server/index.ts never does, same
// as startParkedDrainer). Its blockedAreas/lastAreaOfKey used to live purely
// in that process's own memory, so server/ws.ts's cron loop (index.ts-only —
// see server/ws.ts's startCronLoop(fireCron)) and any canvas flow delivered
// from a turn that closed in the INDEX process (server/canvas/flows.ts,
// registered on both entry points) called isAreaAdmissionBlocked against an
// always-empty set and could never actually be gated by a budget the agent
// process was enforcing. This file persists the loop's verdict to disk so
// every process asking sees the same (at worst a few seconds stale) answer.
//
// The session->area classification itself (autopause-loop.ts's areaCache) is
// NOT part of this file — it's already replicated per-process for free, since
// server/ws/dispatch.ts's 'canvas-get' handler calls updateAreaCacheFromGraph
// on whichever process handles that websocket. Only the *budget verdict*
// (which areas are currently over, and the cron-key->area fallback) is
// agent-process-only and needs this bridge.
function stateFile(): string {
  return process.env.COCKPIT_CANVAS_AREA_ADMISSION ?? join(homedir(), '.cockpit', 'canvas-area-admission.json');
}

// A file this old was left by a loop that stopped ticking (agent process
// crashed/restarted, no new one up yet) — it must NOT go on blocking
// admission forever, so a reader treats it as gone rather than trusting it.
// autopause-loop.ts no longer writes on EVERY tick (only when something is
// actually blocked, or the cron->area map changed — see its syncAdmissionState),
// so this TTL is measured from the last MEANINGFUL write, not a fixed
// heartbeat; still generous relative to the 10s tick.
export const AREA_ADMISSION_TTL_MS = 60_000;
// A timestamp from the FUTURE (relative to this reader's clock) is either a
// clock jump on the writer's box or a corrupt file — never trusted at face
// value, but a few seconds of ordinary clock skew between processes on the
// same host must not falsely condemn a fresh, honest write.
const CLOCK_SKEW_TOLERANCE_MS = 5_000;
// How long a READER (a process with no local loop) trusts its last disk read
// before checking again — bounds how often a hot path (fireCron/drainParked,
// ticking every few seconds) hits the filesystem.
const READ_CACHE_MS = 3_000;

// `at`: when this key was last seen classified (Date.now() at that tick) —
// backs both the 24h staleness prune and, if ever needed, debugging "why is
// this cron still gating admission". NOT the same clock as the file's own
// top-level `at` (that one is the whole snapshot's write time / TTL anchor).
export interface LastAreaEntry { area: AreaId; at: number }

export interface AreaAdmissionState {
  blockedAreas: ReadonlySet<AreaId>;
  lastAreaOfKey: ReadonlyMap<string, LastAreaEntry>;
}

function emptyState(): AreaAdmissionState { return { blockedAreas: new Set(), lastAreaOfKey: new Map() }; }

// The in-memory view this process currently trusts. The WRITER (the agent
// process's own autopause-loop tick) keeps this fresh by calling
// setAreaAdmissionState synchronously every tick — that process never needs
// to round-trip through disk to read its own answer back. A READER process
// only ever updates this via refreshFromDiskIfStale, below.
let state: AreaAdmissionState = emptyState();
let lastDiskReadAt = 0;
let diskReadInFlight = false;
// Once this process has ever called setAreaAdmissionState, it IS the loop —
// trust its own live state forever after, never shadow it with a slower disk
// read (which, worst case, would just read back what this same process wrote).
let isWriter = false;

export function setAreaAdmissionState(next: AreaAdmissionState): void {
  isWriter = true;
  state = next;
}

function serialize(s: AreaAdmissionState, at: number): string {
  return JSON.stringify({
    at,
    blockedAreas: [...s.blockedAreas],
    lastAreaOfKey: Object.fromEntries(s.lastAreaOfKey),
  });
}

// Pure parse + TTL/shape/clock-skew check, exported so the fail-open behavior
// (missing timestamp, stale, future-dated, corrupt JSON, wrong shape) has
// coverage without touching a real file.
export function parseAreaAdmissionFile(raw: string, now: number): AreaAdmissionState | undefined {
  let parsed: { at?: unknown; blockedAreas?: unknown; lastAreaOfKey?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined; // corrupt: fail open
  }
  if (typeof parsed.at !== 'number' || !Number.isFinite(parsed.at)) return undefined;
  if (parsed.at > now + CLOCK_SKEW_TOLERANCE_MS) return undefined; // from the future: clock jump or bogus — fail open
  if (now - parsed.at > AREA_ADMISSION_TTL_MS) return undefined; // stale: fail open (loop stopped ticking)
  if (!Array.isArray(parsed.blockedAreas)) return undefined;
  const lastAreaOfKey = new Map<string, LastAreaEntry>();
  if (parsed.lastAreaOfKey && typeof parsed.lastAreaOfKey === 'object') {
    for (const [k, v] of Object.entries(parsed.lastAreaOfKey as Record<string, unknown>)) {
      const entry = v as { area?: unknown; at?: unknown };
      if (typeof entry?.area === 'string' && typeof entry?.at === 'number') {
        lastAreaOfKey.set(k, { area: entry.area as AreaId, at: entry.at });
      }
    }
  }
  return { blockedAreas: new Set(parsed.blockedAreas as AreaId[]), lastAreaOfKey };
}

// Atomic write, same pid+random tmp pattern as server/canvas/board.ts's
// updateBoard: the loop's own restart (old process finishing a write while a
// fresh one just started ticking) is the one realistic multi-writer case
// here, and a shared tmp name would let one rename land on a still-being-
// written file.
export async function writeAreaAdmissionFile(s: AreaAdmissionState): Promise<void> {
  const f = stateFile();
  await mkdir(dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, serialize(s, Date.now()), 'utf8');
  await rename(tmp, f);
}

// Fire-and-forget, bounded by READ_CACHE_MS — called from the SYNC
// getAreaAdmissionState below, never awaited by it: a disk read must not add
// latency to an admission check on the hot path (fireCron/drainParked tick
// every few seconds). A missing/unreadable file fails open (empty state)
// rather than leaving a possibly-stale blocked set in place past its own TTL.
//
// `pendingRead` exposes the in-flight promise (waitForPendingReadForTest) so
// a test can await the EXACT read it triggered instead of guessing a sleep
// duration — a fixed setTimeout here was flaky under load (review, #599).
let pendingRead: Promise<void> | null = null;
// Bumped by every NEW read and by resetAreaAdmissionForTest. A read whose
// generation no longer matches when it resolves was SUPERSEDED — by a test
// reset (the read from test A landing during test B, clobbering B's already-
// set state — the actual cause of a flaky "blocked" assertion under #599's
// review) or, in real process life, by this process becoming the WRITER
// (setAreaAdmissionState flips isWriter) while an old read was still in
// flight. Either way the stale result must be dropped, never applied.
let readGeneration = 0;

function refreshFromDiskIfStale(): void {
  if (isWriter) return; // this process IS the source of truth
  const now = Date.now();
  if (diskReadInFlight || now - lastDiskReadAt < READ_CACHE_MS) return;
  diskReadInFlight = true;
  lastDiskReadAt = now;
  const myGeneration = ++readGeneration;
  pendingRead = readFile(stateFile(), 'utf8')
    .then((raw) => {
      if (myGeneration !== readGeneration || isWriter) return; // superseded — see readGeneration's comment
      state = parseAreaAdmissionFile(raw, Date.now()) ?? emptyState();
    })
    .catch(() => {
      if (myGeneration !== readGeneration || isWriter) return;
      state = emptyState(); // ENOENT or read error: fail open
    })
    .finally(() => { diskReadInFlight = false; pendingRead = null; });
}

export function getAreaAdmissionState(): AreaAdmissionState {
  refreshFromDiskIfStale();
  return state;
}

// Test-only: awaits the CURRENT background disk read if one is in flight
// (started by the getAreaAdmissionState/isAreaAdmissionBlocked call right
// before it), or resolves immediately if none is — makes a cross-process-read
// test deterministic instead of racing a fixed setTimeout against the real
// fs.readFile.
export function waitForPendingReadForTest(): Promise<void> {
  return pendingRead ?? Promise.resolve();
}

// Test-only: module-level state persists between real ticks/reads on
// purpose, which would otherwise leak between tests. Bumping readGeneration
// invalidates any read still in flight from a PRIOR test (a fire-and-forget
// call from a test that made no assertion about it landing) — without this,
// that old read's `.then()` could resolve during a LATER test and clobber
// state that test had already set, an actually-observed flaky failure.
export function resetAreaAdmissionForTest(): void {
  state = emptyState();
  lastDiskReadAt = 0;
  diskReadInFlight = false;
  pendingRead = null;
  isWriter = false;
  readGeneration++;
}
