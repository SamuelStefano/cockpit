import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ServerMsg } from '../../shared/protocol';
import { sessionPath } from '../sessions/records';
import { listTerms } from '../terminals';
import { runningSessionIds } from '../ws/threads';

// A `claude` running inside a `cockpit-cv-*` tmux shell (a worker the
// Orchestrator delegated to, or the Orchestrator itself) never goes through a
// Deck-run turn, so the kanban's `running` set never sees it and the card
// reads Done while it is still working. Claude Code writes one registry file
// per live process at ~/.claude/sessions/<pid>.json carrying its sessionId,
// its tmux target and a busy/idle status — that is the tmux -> session map.
//
// The SAME registry also covers a case with no tmux at all: Deck itself runs
// two backend processes (server/index.ts, the listen server deckctl talks to,
// and server/agent.ts, the relay agent a browser talks to), each with its OWN
// in-memory `threads` map (server/ws/threads.ts) — a turn started in one is
// completely invisible to the other's `busy` frame. Every `claude -p` child
// either process spawns writes this exact registry file too, so it is the one
// place both processes can see EACH OTHER's live turns without sharing memory.
// `readLivenessSnapshot` below folds both sources (tmux-scoped + general)
// into a DISPLAY list, MINUS this process's own threads (already visible via
// `busy`) — what's left is "live somewhere else", the signal the kanban and
// deckctl status/sessions read. It also computes a SEPARATE, stricter list
// (busySessionIds: alive pid + status 'busy', no fresh-mtime grace period)
// that server/ws/dispatch.ts's 'send' guard uses to refuse a second
// concurrent `--resume` — the display list's grace period would otherwise
// reject a normal follow-up right after a turn closes elsewhere.
//
// Neither list is safe to read from a CACHE for a correctness decision.
// startCvLivenessLoop only refreshes its cache while `hasClients()` — a
// deckctl connection (open for a few seconds, well under the 5s tick) can
// come and go without a single tick running, leaving the cache however many
// hours old it last was. The 'send' guard therefore reads
// readBusyElsewhereSessionIds() fresh on every call (cheap: no JSONL stat),
// and 'canvas-get' calls refreshLivenessSnapshot() fresh instead of reading
// the cache directly — see both further down.

export const CV_FRESH_MS = 2 * 60_000;
const CV_TMUX_RE = /^cockpit-(cv-[^:]+)/;

export interface ClaudeProcRecord {
  pid: number;
  sessionId: string;
  tmux?: string;
  status?: string;
  procStart?: string;
}

export interface CvLivenessInput {
  tmuxAlive: boolean;
  procAlive: boolean;
  busy: boolean;
  jsonlMtime: number | undefined;
  now: number;
}

// Alive shell + busy process, OR a transcript written in the last 2 minutes
// (covers a busy flag that lags, and the brief tail after a turn closes).
export function isCvShellLive(i: CvLivenessInput): boolean {
  if (i.tmuxAlive && i.procAlive && i.busy) return true;
  return i.jsonlMtime !== undefined && i.now - i.jsonlMtime < CV_FRESH_MS;
}

// `cockpit-cv-linkedin:@114.%114` -> `cv-linkedin` (the listTerms() id).
export function cvTermId(tmux: string | undefined): string | undefined {
  return tmux ? CV_TMUX_RE.exec(tmux)?.[1] : undefined;
}

export function parseProcRecord(text: string): ClaudeProcRecord | undefined {
  let o: unknown;
  try { o = JSON.parse(text); } catch { return undefined; }
  if (!o || typeof o !== 'object') return undefined;
  const r = o as Record<string, unknown>;
  if (!Number.isInteger(r.pid) || (r.pid as number) <= 0 || typeof r.sessionId !== 'string') return undefined;
  return {
    pid: r.pid as number,
    sessionId: r.sessionId,
    tmux: typeof r.tmux === 'string' ? r.tmux : undefined,
    status: typeof r.status === 'string' ? r.status : undefined,
    procStart: typeof r.procStart === 'string' || typeof r.procStart === 'number' ? String(r.procStart) : undefined,
  };
}

export interface CvLiveDeps {
  liveTerms: Set<string>;
  procAlive: (pid: number) => boolean;
  mtimeOf: (sessionId: string) => number | undefined;
  now: number;
}

export function liveCvSessionIds(records: ClaudeProcRecord[], d: CvLiveDeps): string[] {
  const out = new Set<string>();
  for (const r of records) {
    const term = cvTermId(r.tmux);
    if (!term) continue;
    const live = isCvShellLive({
      tmuxAlive: d.liveTerms.has(term),
      procAlive: d.procAlive(r.pid),
      busy: r.status === 'busy',
      jsonlMtime: d.mtimeOf(r.sessionId),
      now: d.now,
    });
    if (live) out.add(r.sessionId);
  }
  return [...out].sort();
}

// The process-independent liveness formula (no tmux involved at all): an
// alive pid claiming `busy`, OR — ALSO only for an alive pid — a transcript
// written under CV_FRESH_MS ago. procAlive gates BOTH branches: a stale
// registry file left behind by a dead pid must never count as live just
// because its last transcript write happens to be recent (review: a dead
// process can't be "the brief tail after a turn closes" — that tail only
// exists while the process that wrote it is still around).
export interface RegistryLiveInput { procAlive: boolean; busy: boolean; jsonlMtime: number | undefined; now: number }

export function isRegistrySessionLive(i: RegistryLiveInput): boolean {
  if (!i.procAlive) return false;
  if (i.busy) return true;
  return i.jsonlMtime !== undefined && i.now - i.jsonlMtime < CV_FRESH_MS;
}

export interface RegistryLiveDeps { procAlive: (pid: number) => boolean; mtimeOf: (sessionId: string) => number | undefined; now: number }

export function liveRegistrySessionIds(records: ClaudeProcRecord[], d: RegistryLiveDeps): string[] {
  const out = new Set<string>();
  for (const r of records) {
    const live = isRegistrySessionLive({ procAlive: d.procAlive(r.pid), busy: r.status === 'busy', jsonlMtime: d.mtimeOf(r.sessionId), now: d.now });
    if (live) out.add(r.sessionId);
  }
  return [...out].sort();
}

// STRICT set for server/ws/dispatch.ts's 'send' guard ONLY — never reuse the
// display list above for this. The display formula's fresh-mtime branch is a
// deliberate few-minutes grace period so a card doesn't flicker to "done" the
// instant a turn closes; but that same grace period, fed into the send
// guard, would reject a completely normal follow-up: a browser turn ends
// (its thread is gone from THIS process's `threads`), Samuel replies within
// 2 minutes, the JSONL is still fresh → the old shared check saw
// "live-elsewhere" and refused a message nobody is racing. The guard only
// cares about an ACTUAL other writer right now: alive pid, status 'busy',
// full stop — no fresh-mtime fallback.
export interface BusyElsewhereDeps { procAlive: (pid: number) => boolean }

export function busySessionIds(records: ClaudeProcRecord[], d: BusyElsewhereDeps): string[] {
  const out = new Set<string>();
  for (const r of records) {
    if (r.status === 'busy' && d.procAlive(r.pid)) out.add(r.sessionId);
  }
  return [...out].sort();
}

// A cv-shell that is ALIVE (tmux pane + process both up) but NOT live per
// isCvShellLive — idle, no busy flag, transcript gone stale. That's Claude
// Code sitting at its prompt waiting on Samuel, not a finished turn; without
// this separate signal it just drops out of the live set and the kanban
// reads it as Done (kanban-items.ts deriveSessionStatus falls through to
// 'review' once neither running nor waiting is true).
export function idleCvSessionIds(records: ClaudeProcRecord[], d: CvLiveDeps): string[] {
  const out = new Set<string>();
  for (const r of records) {
    const term = cvTermId(r.tmux);
    if (!term) continue;
    const tmuxAlive = d.liveTerms.has(term);
    const procAlive = d.procAlive(r.pid);
    if (!tmuxAlive || !procAlive) continue;
    const live = isCvShellLive({ tmuxAlive, procAlive, busy: r.status === 'busy', jsonlMtime: d.mtimeOf(r.sessionId), now: d.now });
    if (!live) out.add(r.sessionId);
  }
  return [...out].sort();
}

function procRegistryDir(): string {
  return process.env.COCKPIT_CLAUDE_PROCS_DIR ?? join(homedir(), '.claude', 'sessions');
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
}

// Field 22 of /proc/<pid>/stat (starttime, clock ticks since boot). The comm
// field (2) may hold spaces and parens, so count from the LAST ')'.
export function procStartTicks(statText: string): string | undefined {
  const rest = statText.slice(statText.lastIndexOf(')') + 2).split(' ');
  return rest[19] || undefined;
}

// A registry file whose pid now belongs to a different process (pid reuse
// after a crash) must not vouch for anything. No procStart recorded, or no
// /proc (non-Linux) = nothing to compare, trust as before.
export function procStartMatches(recorded: string | undefined, statText: string | undefined): boolean {
  if (!recorded || statText === undefined) return true;
  return procStartTicks(statText) === recorded;
}

async function isSameProcess(r: ClaudeProcRecord): Promise<boolean> {
  if (!r.procStart) return true;
  const text = await readFile(`/proc/${r.pid}/stat`, 'utf8').catch(() => undefined);
  return procStartMatches(r.procStart, text);
}

async function readRecords(dir: string): Promise<ClaudeProcRecord[]> {
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.json'));
  const parsed = (await Promise.all(files.map((f) => readFile(join(dir, f), 'utf8').then(parseProcRecord, () => undefined))))
    .filter((r): r is ClaudeProcRecord => !!r);
  const same = await Promise.all(parsed.map(isSameProcess));
  return parsed.filter((_, i) => same[i]);
}

// FRESH read for server/ws/dispatch.ts's 'send' guard — called on every send,
// so it deliberately skips the expensive half of readLivenessSnapshot below
// (no JSONL stat, no tmux/listTerms lookup): just the registry dir (a
// handful of tiny files) plus a pid-alive check per record, which is exactly
// what busySessionIds needs. A cached snapshot would go stale between ticks
// of startCvLivenessLoop (which only runs while a client is connected) —
// deckctl connects for under 5s, well inside the 5s tick interval, so the
// guard would sometimes act on data hours old. This has no such window.
export async function readBusyElsewhereSessionIds(): Promise<string[]> {
  const records = await readRecords(procRegistryDir());
  if (!records.length) return [];
  const busyIds = busySessionIds(records, { procAlive: pidAlive });
  const own = runningSessionIds();
  return busyIds.filter((id) => !own.has(id)).sort();
}

export interface LivenessSnapshot {
  live: string[];          // display: tmux-cv-shell live ∪ general registry live, minus own threads
  busyElsewhere: string[]; // strict, for the send guard: alive pid + status 'busy' only, minus own threads
  idle: string[];          // tmux-cv-shell alive but not live (waiting on Samuel), minus own threads
}

// One registry scan feeds all three sets — reading the (tiny) directory and
// stat'ing each registry session's JSONL only once per tick, not once per
// consumer. All three are MINUS this process's own live threads (an ordinary
// local turn writes a registry file too — without the subtraction it would
// wrongly show up as "live elsewhere" and get folded into the cv-shell/
// orchestrator-child swimlane on the kanban, see kanban-items.ts
// orchestratorChild). What is left in `live`/`busyElsewhere` is exactly
// "live, but not one of MY threads" — a cv-shell worker, OR a turn running
// in the OTHER Deck process.
export async function readLivenessSnapshot(now = Date.now()): Promise<LivenessSnapshot> {
  const records = await readRecords(procRegistryDir());
  if (!records.length) return { live: [], busyElsewhere: [], idle: [] };
  // Stat every registry session's JSONL (sessionPath UUID-validates and
  // anti-traversal-guards the path — server/sessions/records.ts) — still tiny:
  // the registry only ever holds as many files as there are live `claude`
  // processes on the box, never the full session history.
  const mtimes = new Map<string, number>();
  await Promise.all(records.map(async (r) => {
    const p = sessionPath(r.sessionId);
    const st = p ? await stat(p).catch(() => null) : null;
    if (st) mtimes.set(r.sessionId, st.mtimeMs);
  }));
  const liveTerms = new Set(await listTerms());
  const deps = { procAlive: pidAlive, mtimeOf: (id: string) => mtimes.get(id), now };
  const cvRecords = records.filter((r) => !!cvTermId(r.tmux));
  const cvIds = liveCvSessionIds(cvRecords, { ...deps, liveTerms });
  const generalIds = liveRegistrySessionIds(records, deps);
  const busyIds = busySessionIds(records, { procAlive: pidAlive });
  const idleIds = idleCvSessionIds(cvRecords, { ...deps, liveTerms });
  const own = runningSessionIds();
  return {
    live: [...new Set([...cvIds, ...generalIds])].filter((id) => !own.has(id)).sort(),
    busyElsewhere: busyIds.filter((id) => !own.has(id)).sort(),
    idle: idleIds.filter((id) => !own.has(id)).sort(),
  };
}

let lastLive: string[] = [];
let lastBusyElsewhere: string[] = [];
let lastIdle: string[] = [];

// Cached DISPLAY snapshot — DIAGNOSTIC/last-known-value use only. It is only
// ever refreshed by refreshLivenessSnapshot below, which runs on the
// startCvLivenessLoop tick (gated on `hasClients()` — only while a client is
// actually connected) AND on-demand from 'canvas-get'. Between those, it can
// be stale by design: NEVER read this for a correctness decision (the 'send'
// guard learned that the hard way — see readBusyElsewhereSessionIds above,
// which reads fresh every time instead of trusting this cache. deckctl
// connects to index.ts for well under the 5s tick interval, so relying on
// this cache there meant acting on data that could be hours old).
export function lastCvLiveSessionIds(): string[] {
  return lastLive;
}

// Cached STRICT snapshot — same staleness caveat as lastCvLiveSessionIds
// above. Diagnostic only; the 'send' guard uses readBusyElsewhereSessionIds
// (fresh) instead.
export function lastBusyElsewhereSessionIds(): string[] {
  return lastBusyElsewhere;
}

// Cached idle-cv-shell snapshot — same staleness caveat.
export function lastIdleCvSessionIds(): string[] {
  return lastIdle;
}

// Fresh read that ALSO updates the three caches above — used by the loop
// tick and by 'canvas-get' (server/ws/dispatch.ts), so a client that just
// asked for the board always sees data at least as fresh as its own request,
// never whatever the periodic tick last saw (which can be stale or, right
// after boot / a long client-less gap, simply absent).
export async function refreshLivenessSnapshot(now = Date.now()): Promise<LivenessSnapshot> {
  const snap = await readLivenessSnapshot(now);
  lastLive = snap.live;
  lastBusyElsewhere = snap.busyElsewhere;
  lastIdle = snap.idle;
  return snap;
}

// Both Deck backend processes (server/ws.ts's attachWs for index.ts,
// server/agent.ts's runAgent for the relay) start this loop, each pushing
// through its own admin-only emit (server/ws/canvas-clients.ts's
// emitCanvasMsg) — that is what makes "live in the other process" a signal
// EITHER process can compute and expose on its own, no shared memory needed.
// Pushes only on a display-relevant change (live or idle) to whichever
// clients are already connected; a client that (re)connects gets a FRESH
// read straight from 'canvas-get', not this loop's possibly-stale cache.
export function startCvLivenessLoop(hasClients: () => boolean, emit: (msg: ServerMsg) => void, intervalMs = 5000) {
  let busy = false;
  const tick = async () => {
    if (busy || !hasClients()) return;
    busy = true;
    try {
      const prevLive = lastLive.join();
      const prevIdle = lastIdle.join();
      const snap = await refreshLivenessSnapshot();
      if (snap.live.join() !== prevLive || snap.idle.join() !== prevIdle) {
        emit({ t: 'cv-live', sessionIds: snap.live, idleSessionIds: snap.idle });
      }
    } catch { /* best-effort, like the other loops */ } finally { busy = false; }
  };
  setInterval(tick, intervalMs).unref();
}
