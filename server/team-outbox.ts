import { mkdir, readdir, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { TeamBot } from '../shared/protocol';
import { judgeTeamMessage, MAX_TEAM_TEXT_BYTES, TEAM_MSG_ID_RE, type TeamMessage, type TeamMessageStatus } from '../shared/team-messages';
import { appendTeamLog, hasLogged, isTeamPaused, readTeamLog, readTeamLogSince, sentSince, teamLogFile, teamLogSize, teamOutboxDir } from './team-log';
import { withFileLockAsync } from './ws/file-lock';

// What team-mcp.mjs drops in the outbox, one file per message.
export interface SpoolHandoff { taskId: string; done: string; pending: string; reason: string; switchPoint: string }
export interface SpoolMessage { id: string; from: string; to: string; text: string; hop: number; ts: number; handoff?: SpoolHandoff }

export type HandoffOutcome = { ok: true; text: string } | { ok: false; reason: string };

export type Delivery = 'delivered' | 'queued' | 'failed';

export interface OutboxDeps {
  getTeam: () => Promise<TeamBot[]>;
  deliver: (m: SpoolMessage, team: TeamBot[]) => Promise<Delivery>;
  applyHandoff?: (m: SpoolMessage & { handoff: SpoolHandoff }, team: TeamBot[]) => Promise<HandoffOutcome>;
  emit?: (m: TeamMessage) => void;
  now?: () => number;
}

const SPOOL_RE = /^(m[a-z0-9]{6,32})\.json$/;
const CLAIMED_RE = /^(m[a-z0-9]{6,32})\.(\d+)\.json$/;
const HOUR_MS = 3_600_000;

const processingDir = (dir: string) => join(dir, 'processing');

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
}

// Both Deck processes poll the same outbox. rename() is atomic on one
// filesystem: of two processes renaming the same file, exactly one succeeds and
// the other gets ENOENT — that is the whole claim.
export async function claimOutbox(dir = teamOutboxDir(), pid = process.pid): Promise<string[]> {
  let names: string[];
  try { names = await readdir(dir); } catch { return []; }
  const proc = processingDir(dir);
  await mkdir(proc, { recursive: true });
  const claimed: string[] = [];
  for (const name of names.sort()) {
    const m = SPOOL_RE.exec(name);
    if (!m) continue;
    const target = join(proc, `${m[1]}.${pid}.json`);
    try { await rename(join(dir, name), target); claimed.push(target); } catch { /* the other process won it */ }
  }
  return claimed;
}

// A process that died between claim and log leaves its file in processing/.
// Logged = it was handled, drop it; not logged = hand it back to the outbox.
export async function recoverStale(dir = teamOutboxDir(), log?: TeamMessage[]): Promise<void> {
  const proc = processingDir(dir);
  let names: string[];
  try { names = await readdir(proc); } catch { return; }
  const stale = names.map((n) => CLAIMED_RE.exec(n)).filter((m): m is RegExpExecArray => !!m && Number(m[2]) !== process.pid && !pidAlive(Number(m[2])));
  if (!stale.length) return;
  const known = log ?? await readTeamLog();
  for (const m of stale) {
    const from = join(proc, m[0]);
    if (hasLogged(known, m[1])) await unlink(from).catch(() => {});
    else await rename(from, join(dir, `${m[1]}.json`)).catch(() => {});
  }
}

function parseHandoff(raw: unknown): SpoolHandoff | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const keys = ['taskId', 'done', 'pending', 'reason', 'switchPoint'] as const;
  if (!keys.every((k) => typeof r[k] === 'string')) return undefined;
  return { taskId: r.taskId as string, done: r.done as string, pending: r.pending as string, reason: r.reason as string, switchPoint: r.switchPoint as string };
}

export function parseSpool(raw: string): SpoolMessage | null {
  try {
    const r = JSON.parse(raw) as Record<string, unknown>;
    if (typeof r.id !== 'string' || !TEAM_MSG_ID_RE.test(r.id)) return null;
    if (typeof r.from !== 'string' || typeof r.to !== 'string' || typeof r.text !== 'string') return null;
    const handoff = parseHandoff(r.handoff);
    const hop = Number.isInteger(r.hop) && (r.hop as number) > 0 ? (r.hop as number) : 1;
    return { id: r.id, from: r.from, to: r.to, text: r.text, hop, ts: typeof r.ts === 'number' ? r.ts : Date.now(), ...(handoff ? { handoff } : {}) };
  } catch { return null; }
}

function invalid(m: SpoolMessage, team: TeamBot[]): string | undefined {
  if (!team.some((b) => b.id === m.from)) return 'remetente não é da equipe';
  if (!team.some((b) => b.id === m.to)) return 'destinatário não é da equipe';
  if (m.from === m.to) return 'um bot não manda mensagem pra si mesmo';
  if (!m.handoff && !m.text.trim()) return 'mensagem vazia';
  if (Buffer.byteLength(m.text) > MAX_TEAM_TEXT_BYTES) return 'mensagem passa de 8KB';
  return undefined;
}

async function resolveHandoff(spool: SpoolMessage, team: TeamBot[], deps: OutboxDeps): Promise<HandoffOutcome | null> {
  if (!spool.handoff) return null;
  if (!deps.applyHandoff) return { ok: false, reason: 'passagem de tarefa indisponível' };
  try { return await deps.applyHandoff({ ...spool, handoff: spool.handoff }, team); }
  catch (e) { return { ok: false, reason: (e as Error).message.slice(0, 200) }; }
}

async function judgeAndDeliver(spool: SpoolMessage, team: TeamBot[], log: TeamMessage[], deps: OutboxDeps, nowMs: number): Promise<{ status: TeamMessageStatus; reason?: string; text: string }> {
  const bad = invalid(spool, team);
  if (bad) return { status: 'blocked', reason: bad, text: spool.text };
  const verdict = judgeTeamMessage({ paused: isTeamPaused(), hop: spool.hop, sentLastHour: sentSince(log, spool.from, nowMs - HOUR_MS) });
  if (!verdict.ok) return { status: 'blocked', reason: verdict.reason, text: spool.text };
  const handoff = await resolveHandoff(spool, team, deps);
  if (handoff && !handoff.ok) return { status: 'blocked', reason: handoff.reason, text: spool.text };
  const msg = handoff?.ok ? { ...spool, text: handoff.text } : spool;
  try {
    const status = await deps.deliver(msg, team);
    return { status, text: msg.text, ...(status === 'failed' ? { reason: 'não consegui entregar' } : {}) };
  } catch (e) { return { status: 'failed', reason: (e as Error).message.slice(0, 200), text: msg.text }; }
}

// Judge, deliver and log one claimed message under the log's lock: the hourly
// budget is counted from the log, and two processes counting at once would both
// see room for the 30th message. A handoff applies to the task between the
// brakes and the delivery, so a blocked one changes nothing.
export async function processClaimed(path: string, deps: OutboxDeps): Promise<TeamMessage | null> {
  const raw = await readFile(path, 'utf8').catch(() => null);
  const spool = raw === null ? null : parseSpool(raw);
  if (!spool) { await unlink(path).catch(() => {}); return null; }
  const now = deps.now ?? Date.now;
  const entry = await withFileLockAsync(teamLogFile(), async (): Promise<TeamMessage | null> => {
    const log = await readTeamLog();
    if (hasLogged(log, spool.id)) return null;
    const out = await judgeAndDeliver(spool, await deps.getTeam(), log, deps, now());
    const m: TeamMessage = { id: spool.id, from: spool.from, to: spool.to, text: out.text.slice(0, MAX_TEAM_TEXT_BYTES * 2), ts: now(), status: out.status, hop: spool.hop };
    if (out.reason) m.reason = out.reason;
    await appendTeamLog(m);
    return m;
  });
  await unlink(path).catch(() => {});
  if (entry) deps.emit?.(entry);
  return entry;
}

let draining = false;
export async function drainOutbox(deps: OutboxDeps, dir = teamOutboxDir()): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    await recoverStale(dir);
    for (const path of await claimOutbox(dir)) await processClaimed(path, deps).catch((e) => console.error('[team-outbox]', (e as Error).message));
  } finally { draining = false; }
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startTeamOutbox(deps: OutboxDeps, onLogged: (m: TeamMessage) => void, intervalMs = 1_500): void {
  if (timer) return;
  let offset: number | undefined;
  const tick = async () => {
    await drainOutbox(deps);
    if (offset === undefined) { offset = await teamLogSize(); return; }
    const r = await readTeamLogSince(offset);
    offset = r.offset;
    for (const m of r.items) onLogged(m);
  };
  timer = setInterval(() => { void tick().catch(() => {}); }, intervalMs);
  timer.unref?.();
}
