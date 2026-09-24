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
// `readCvLiveSessionIds` below folds both sources (tmux-scoped + general) into
// one list, MINUS this process's own threads (already visible via `busy`) —
// what's left is "live somewhere else", the display-only signal the kanban
// and deckctl status/sessions read, and the signal server/ws/dispatch.ts's
// 'send' guard uses to refuse a second concurrent `--resume` on a session
// already live in the other process.

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
// alive pid claiming `busy`, or a transcript written under CV_FRESH_MS ago —
// same shape as isCvShellLive's fresh-mtime branch, minus the tmux
// requirement on the busy branch, because a headless `claude -p` (any Deck
// turn, in EITHER server process) never has a tmux target to check.
export interface RegistryLiveInput { procAlive: boolean; busy: boolean; jsonlMtime: number | undefined; now: number }

export function isRegistrySessionLive(i: RegistryLiveInput): boolean {
  if (i.procAlive && i.busy) return true;
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

function procRegistryDir(): string {
  return process.env.COCKPIT_CLAUDE_PROCS_DIR ?? join(homedir(), '.claude', 'sessions');
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
}

// Union of both liveness sources, MINUS this process's own live threads (an
// ordinary local turn writes a registry file too — without the subtraction
// it would wrongly show up as "live elsewhere" and get folded into the
// cv-shell/orchestrator-child swimlane on the kanban, see kanban-items.ts
// orchestratorChild). What is left is exactly "live, but not one of MY
// threads" — a cv-shell worker, OR a turn running in the OTHER Deck process.
export async function readCvLiveSessionIds(now = Date.now()): Promise<string[]> {
  const dir = procRegistryDir();
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.json'));
  const records = (await Promise.all(files.map((f) => readFile(join(dir, f), 'utf8').then(parseProcRecord, () => undefined))))
    .filter((r): r is ClaudeProcRecord => !!r);
  if (!records.length) return [];
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
  const cvIds = liveCvSessionIds(records.filter((r) => !!cvTermId(r.tmux)), { ...deps, liveTerms });
  const generalIds = liveRegistrySessionIds(records, deps);
  const own = runningSessionIds();
  return [...new Set([...cvIds, ...generalIds])].filter((id) => !own.has(id)).sort();
}

let last: string[] = [];

// Cached snapshot of readCvLiveSessionIds() for THIS process, refreshed every
// `intervalMs` by the loop below. Two readers: the 'cv-live' push/'canvas-get'
// reply (display), and server/ws/dispatch.ts's 'send' guard (safety) — both
// prefer this cheap in-memory read over a fresh registry scan per call.
export function lastCvLiveSessionIds(): string[] {
  return last;
}

// Both Deck backend processes (server/ws.ts's attachWs for index.ts,
// server/agent.ts's runAgent for the relay) start this loop, each pushing
// through its own admin-only emit (server/ws/canvas-clients.ts's
// emitCanvasMsg) — that is what makes "live in the other process" a signal
// EITHER process can compute and expose on its own, no shared memory needed.
// Pushes only on change; a new canvas client gets `last` on 'canvas-get'.
export function startCvLivenessLoop(hasClients: () => boolean, emit: (msg: ServerMsg) => void, intervalMs = 5000) {
  let busy = false;
  const tick = async () => {
    if (busy || !hasClients()) return;
    busy = true;
    try {
      const ids = await readCvLiveSessionIds();
      if (ids.join() !== last.join()) {
        last = ids;
        emit({ t: 'cv-live', sessionIds: ids });
      }
    } catch { /* best-effort, like the other loops */ } finally { busy = false; }
  };
  setInterval(tick, intervalMs).unref();
}
