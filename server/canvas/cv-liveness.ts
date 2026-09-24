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

export const CV_FRESH_MS = 2 * 60_000;
const CV_TMUX_RE = /^cockpit-(cv-[^:]+)/;

export interface ClaudeProcRecord {
  pid: number;
  sessionId: string;
  tmux?: string;
  status?: string;
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
  const dir = procRegistryDir();
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.json'));
  const records = (await Promise.all(files.map((f) => readFile(join(dir, f), 'utf8').then(parseProcRecord, () => undefined))))
    .filter((r): r is ClaudeProcRecord => !!r);
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

// Cached DISPLAY snapshot for THIS process, refreshed every `intervalMs` by
// the loop below — the 'cv-live' push/'canvas-get' reply prefers this cheap
// in-memory read over a fresh registry scan per call.
export function lastCvLiveSessionIds(): string[] {
  return lastLive;
}

// Cached STRICT snapshot for server/ws/dispatch.ts's 'send' guard ONLY — see
// busySessionIds' doc comment for why this must stay separate from the
// display list above (the display list's fresh-mtime grace period would
// reject a normal follow-up right after a turn closes elsewhere).
export function lastBusyElsewhereSessionIds(): string[] {
  return lastBusyElsewhere;
}

// Cached idle-cv-shell snapshot — see idleCvSessionIds' doc comment.
export function lastIdleCvSessionIds(): string[] {
  return lastIdle;
}

// Both Deck backend processes (server/ws.ts's attachWs for index.ts,
// server/agent.ts's runAgent for the relay) start this loop, each pushing
// through its own admin-only emit (server/ws/canvas-clients.ts's
// emitCanvasMsg) — that is what makes "live in the other process" a signal
// EITHER process can compute and expose on its own, no shared memory needed.
// Pushes only on a display-relevant change (live or idle); busyElsewhere is
// only ever read on-demand by the send guard, never pushed.
export function startCvLivenessLoop(hasClients: () => boolean, emit: (msg: ServerMsg) => void, intervalMs = 5000) {
  let busy = false;
  const tick = async () => {
    if (busy || !hasClients()) return;
    busy = true;
    try {
      const snap = await readLivenessSnapshot();
      lastBusyElsewhere = snap.busyElsewhere;
      if (snap.live.join() !== lastLive.join() || snap.idle.join() !== lastIdle.join()) {
        lastLive = snap.live;
        lastIdle = snap.idle;
        emit({ t: 'cv-live', sessionIds: snap.live, idleSessionIds: snap.idle });
      }
    } catch { /* best-effort, like the other loops */ } finally { busy = false; }
  };
  setInterval(tick, intervalMs).unref();
}
