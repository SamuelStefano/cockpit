import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ServerMsg } from '../../shared/protocol';
import { sessionPath } from '../sessions/records';
import { listTerms } from '../terminals';

// A `claude` running inside a `cockpit-cv-*` tmux shell (a worker the
// Orchestrator delegated to, or the Orchestrator itself) never goes through a
// Deck-run turn, so the kanban's `running` set never sees it and the card
// reads Done while it is still working. Claude Code writes one registry file
// per live process at ~/.claude/sessions/<pid>.json carrying its sessionId,
// its tmux target and a busy/idle status — that is the tmux -> session map.

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
  if (typeof r.pid !== 'number' || typeof r.sessionId !== 'string') return undefined;
  return {
    pid: r.pid,
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

function procRegistryDir(): string {
  return process.env.COCKPIT_CLAUDE_PROCS_DIR ?? join(homedir(), '.claude', 'sessions');
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
}

export async function readCvLiveSessionIds(now = Date.now()): Promise<string[]> {
  const dir = procRegistryDir();
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.json'));
  const records = (await Promise.all(files.map((f) => readFile(join(dir, f), 'utf8').then(parseProcRecord, () => undefined))))
    .filter((r): r is ClaudeProcRecord => !!r && !!cvTermId(r.tmux));
  if (!records.length) return [];
  const mtimes = new Map<string, number>();
  await Promise.all(records.map(async (r) => {
    const p = sessionPath(r.sessionId);
    const st = p ? await stat(p).catch(() => null) : null;
    if (st) mtimes.set(r.sessionId, st.mtimeMs);
  }));
  const liveTerms = new Set(await listTerms());
  return liveCvSessionIds(records, { liveTerms, procAlive: pidAlive, mtimeOf: (id) => mtimes.get(id), now });
}

let last: string[] = [];

export function lastCvLiveSessionIds(): string[] {
  return last;
}

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
