import { appendFile, mkdir, open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { coerceTeamMessage, involves, betweenPair, type TeamMessage } from '../shared/team-messages';

// Read at call time so tests (and the MCP argv built per turn) follow the env.
export function teamFile(): string {
  return process.env.COCKPIT_TEAM ?? join(homedir(), '.cockpit', 'team.json');
}
export function teamLogFile(): string {
  return process.env.COCKPIT_TEAM_LOG ?? join(homedir(), '.cockpit', 'team-messages.jsonl');
}
export function teamOutboxDir(): string {
  return process.env.COCKPIT_TEAM_OUTBOX ?? join(homedir(), '.cockpit', 'team-outbox');
}
export function teamPauseFile(): string {
  return process.env.COCKPIT_TEAM_PAUSE ?? join(homedir(), '.cockpit', 'team-paused.json');
}

// Past this size the log rolls over to `.1`: the hourly budget and the recent
// threads only ever need the tail, and every read parses the whole file.
export const MAX_LOG_BYTES = 4 * 1024 * 1024;

export async function appendTeamLog(m: TeamMessage): Promise<void> {
  const file = teamLogFile();
  await mkdir(dirname(file), { recursive: true });
  const size = await stat(file).then((s) => s.size, () => 0);
  if (size > MAX_LOG_BYTES) await rename(file, `${file}.1`).catch(() => {});
  await appendFile(file, `${JSON.stringify(m)}\n`, 'utf8');
}

export function parseTeamLog(raw: string): TeamMessage[] {
  const out: TeamMessage[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { const m = coerceTeamMessage(JSON.parse(line)); if (m) out.push(m); } catch { /* a torn line must not hide the rest */ }
  }
  return out;
}

export async function readTeamLog(): Promise<TeamMessage[]> {
  try { return parseTeamLog(await readFile(teamLogFile(), 'utf8')); } catch { return []; }
}

export function hasLogged(log: TeamMessage[], id: string): boolean {
  return log.some((m) => m.id === id);
}

// Only what actually went out spends the budget: a blocked message cost no turn.
export function sentSince(log: TeamMessage[], from: string, since: number): number {
  return log.filter((m) => m.from === from && m.ts >= since && (m.status === 'delivered' || m.status === 'queued')).length;
}

export const TEAM_PAGE = 200;

export function queryTeamLog(log: TeamMessage[], q: { botId?: string; peer?: string; before?: number }, limit = TEAM_PAGE): TeamMessage[] {
  const hits = log.filter((m) =>
    (q.before === undefined || m.ts < q.before)
    && (!q.botId || (q.peer ? betweenPair(m, q.botId, q.peer) : involves(m, q.botId))));
  return hits.slice(-limit);
}

export function isTeamPaused(): boolean {
  try { return JSON.parse(readFileSync(teamPauseFile(), 'utf8'))?.paused === true; } catch { return false; }
}

export async function setTeamPaused(paused: boolean): Promise<void> {
  const file = teamPauseFile();
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify({ paused, at: Date.now() }) + '\n', 'utf8');
  await rename(tmp, file);
}

// New log lines since `offset`. Each Deck process broadcasts what it reads here,
// so a message claimed by the other process still reaches this one's tabs.
// A file shorter than the offset rolled over: start again from its top.
export async function readTeamLogSince(offset: number): Promise<{ items: TeamMessage[]; offset: number }> {
  const file = teamLogFile();
  const size = await stat(file).then((s) => s.size, () => 0);
  const from = size < offset ? 0 : offset;
  if (size === from) return { items: [], offset: size };
  const fh = await open(file, 'r');
  try {
    const buf = Buffer.alloc(size - from);
    await fh.read(buf, 0, buf.length, from);
    const text = buf.toString('utf8');
    const end = text.lastIndexOf('\n') + 1;
    return { items: parseTeamLog(text.slice(0, end)), offset: from + Buffer.byteLength(text.slice(0, end)) };
  } finally { await fh.close(); }
}

export async function teamLogSize(): Promise<number> {
  return stat(teamLogFile()).then((s) => s.size, () => 0);
}
