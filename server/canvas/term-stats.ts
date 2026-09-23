import { open, readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { watchTermId, type TermStats } from '../../shared/canvas';
import { CONFIG } from '../config';

// Live numbers for the canvas terminal windows: CPU and memory of everything a
// session has running (the Deck's `claude -p` turn plus whatever lives in its
// tmux pane) and how full its context is. Read straight from /proc and the
// transcript tail, on demand — nothing runs while no canvas is open.

const CLK_TCK = 100;
const PAGE_KB = 4;
const TAIL_BYTES = 256 * 1024;

export interface ProcRow { pid: number; ppid: number; ticks: number; rssKb: number; comm: string }

// The command name sits in parentheses and may itself contain spaces or ')',
// so fields are counted from the LAST ')'.
export function parseProcStat(raw: string): ProcRow | null {
  const open = raw.indexOf('(');
  const close = raw.lastIndexOf(')');
  if (close < 0 || open < 0) return null;
  const pid = Number(raw.slice(0, raw.indexOf(' ')));
  const comm = raw.slice(open + 1, close);
  const f = raw.slice(close + 2).split(' ');
  const ppid = Number(f[1]);
  const ticks = Number(f[11]) + Number(f[12]);
  const rssKb = Number(f[21]) * PAGE_KB;
  if (![pid, ppid, ticks, rssKb].every(Number.isFinite)) return null;
  return { pid, ppid, ticks, rssKb, comm };
}

export function treeOf(roots: number[], rows: ProcRow[]): ProcRow[] {
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const kids = new Map<number, number[]>();
  for (const r of rows) kids.set(r.ppid, [...(kids.get(r.ppid) ?? []), r.pid]);
  const out: ProcRow[] = [];
  const seen = new Set<number>();
  const stack = roots.filter((p) => byPid.has(p));
  while (stack.length) {
    const pid = stack.pop()!;
    if (seen.has(pid)) continue;
    seen.add(pid);
    out.push(byPid.get(pid)!);
    stack.push(...(kids.get(pid) ?? []));
  }
  return out;
}

// % of ONE core over the window since the previous sample (can pass 100 on a
// multi-threaded tree). A shrinking tree (a tool exited) reads as 0, not negative.
export function cpuPercent(prev: { ticks: number; at: number } | undefined, ticks: number, at: number): number {
  if (!prev || at <= prev.at) return 0;
  return Math.max(0, ((ticks - prev.ticks) / CLK_TCK) / ((at - prev.at) / 1000) * 100);
}

// Context = what the last assistant turn sent in (fresh + cached input).
export function lastUsage(tail: string): { contextTokens?: number; model?: string; lastAt?: number } {
  const out: { contextTokens?: number; model?: string; lastAt?: number } = {};
  const lines = tail.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.startsWith('{')) continue;
    let rec: { type?: string; timestamp?: string; message?: { model?: string; usage?: Record<string, number> } };
    try { rec = JSON.parse(line); } catch { continue; }
    if (out.lastAt === undefined && typeof rec.timestamp === 'string') {
      const t = Date.parse(rec.timestamp);
      if (Number.isFinite(t)) out.lastAt = t;
    }
    const u = rec.type === 'assistant' ? rec.message?.usage : undefined;
    if (u && out.contextTokens === undefined) {
      out.contextTokens = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
      if (rec.message?.model && rec.message.model !== '<synthetic>') out.model = rec.message.model;
    }
    if (out.contextTokens !== undefined && out.lastAt !== undefined) break;
  }
  return out;
}

async function readProcs(): Promise<ProcRow[]> {
  const names = await readdir('/proc').catch(() => [] as string[]);
  const rows = await Promise.all(names.filter((n) => /^\d+$/.test(n)).map((n) =>
    readFile(`/proc/${n}/stat`, 'utf8').then(parseProcStat, () => null)));
  return rows.filter((r): r is ProcRow => r !== null);
}

function panePids(): Promise<Map<string, number>> {
  return new Promise((resolve) => {
    const out = new Map<string, number>();
    const p = spawn('tmux', ['list-panes', '-a', '-F', '#{session_name} #{pane_pid}'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.on('close', () => {
      for (const line of buf.split('\n')) {
        const [name, pid] = line.trim().split(' ');
        if (name?.startsWith('cockpit-') && Number(pid) > 0) out.set(name.slice('cockpit-'.length), Number(pid));
      }
      resolve(out);
    });
    p.on('error', () => resolve(out));
  });
}

async function readTail(file: string): Promise<string> {
  const fh = await open(file, 'r').catch(() => null);
  if (!fh) return '';
  try {
    const { size } = await fh.stat();
    const len = Math.min(size, TAIL_BYTES);
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, size - len);
    return buf.toString('utf8');
  } finally {
    await fh.close();
  }
}

const SESSION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TERM_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const MAX_IDS = 40;

export type CpuSamples = Map<string, { ticks: number; at: number }>;

// The client's 3s canvas-term-stats poll and the server's own autopause loop
// (10s tick) both call this function, and cpuPercent is a DELTA against the
// PREVIOUS sample per key. A single shared map made whichever caller ran last
// overwrite the other's baseline — the loop's 10s tick would zero out (or
// wildly skew) the very next 3s poll's reading, regressing the #589 analysis
// bar. Each caller now owns its own sample store; collectTermStats no longer
// has an implicit default so a caller can never forget to pass one and
// silently share the shared store's samples with someone else.
export function newCpuSamples(): CpuSamples {
  return new Map();
}

// Belt-and-suspenders on top of the per-round "not asked" eviction below: a
// caller whose `asked` set has a bug (or who simply stops calling) must not
// leak samples forever.
const SAMPLE_MAX_AGE_MS = 5 * 60_000;

// Pure decision: does this pane's process tree contain a `claude` process?
// True = someone (Deck's own "retomar" button, or by hand) resumed the watch
// pane INTERACTIVELY — routing another 'send' there (the canvas prompt bar,
// or anything else) would start a SECOND writer on the same transcript.
// `undefined` pane = no watch pane open at all for this session (the common
// case for a session never opened as a canvas window) — never a match.
export function paneHasInteractiveClaude(pane: number | undefined, rows: ProcRow[]): boolean {
  if (pane === undefined) return false;
  return treeOf([pane], rows).some((r) => r.comm === 'claude');
}

// I/O wrapper: same two primitives collectTermStats() already pays for
// (readProcs/panePids), but ordered cheap-first — the tmux pane lookup runs
// before the full /proc scan, so a session with no watch pane (never opened
// on the canvas) never pays for the scan at all.
export async function hasInteractiveClaude(sessionId: string): Promise<boolean> {
  if (!SESSION_UUID_RE.test(sessionId)) return false;
  const panes = await panePids();
  const pane = panes.get(watchTermId(sessionId));
  if (pane === undefined) return false;
  const rows = await readProcs();
  return paneHasInteractiveClaude(pane, rows);
}

export interface RunPids { sessionId?: string; key: string; pid?: number; startedAt: number }

export async function collectTermStats(
  sessions: string[], terms: string[], runs: RunPids[], samples: CpuSamples,
): Promise<Record<string, TermStats>> {
  const sids = sessions.filter((s) => SESSION_UUID_RE.test(s)).slice(0, MAX_IDS);
  const tids = terms.filter((t) => TERM_ID_RE.test(t)).slice(0, MAX_IDS);
  const [rows, panes] = await Promise.all([readProcs(), panePids()]);
  const now = Date.now();
  const out: Record<string, TermStats> = {};

  const measure = (key: string, roots: number[]): Pick<TermStats, 'cpu' | 'rssMb' | 'procs'> => {
    const tree = treeOf(roots, rows);
    const ticks = tree.reduce((a, r) => a + r.ticks, 0);
    const cpu = cpuPercent(samples.get(key), ticks, now);
    samples.set(key, { ticks, at: now });
    return { cpu: Math.round(cpu), rssMb: Math.round(tree.reduce((a, r) => a + r.rssKb, 0) / 1024), procs: tree.length };
  };

  await Promise.all(sids.map(async (sid) => {
    const run = runs.find((r) => r.sessionId === sid || r.key === sid);
    const pane = panes.get(watchTermId(sid));
    const roots = [run?.pid, pane].filter((p): p is number => typeof p === 'number');
    const usage = lastUsage(await readTail(join(CONFIG.projectsDir, `${sid}.jsonl`)));
    out[sid] = { ...measure(`s:${sid}`, roots), ...usage, turnStartedAt: run?.startedAt };
  }));
  for (const tid of tids) {
    const pane = panes.get(tid);
    out[tid] = measure(`t:${tid}`, pane ? [pane] : []);
  }
  // Forget samples nobody asked for this round (own store now, so this can no
  // longer prune a different caller's entries), plus a max-age sweep as a
  // second line of defense.
  const asked = new Set([...sids.map((s) => `s:${s}`), ...tids.map((t) => `t:${t}`)]);
  for (const [k, v] of samples) if (!asked.has(k) || now - v.at > SAMPLE_MAX_AGE_MS) samples.delete(k);
  return out;
}
