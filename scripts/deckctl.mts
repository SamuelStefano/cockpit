#!/usr/bin/env -S npx tsx
// deckctl: command-line orchestrator for the /canvas page — speaks the SAME
// WebSocket protocol the browser uses (ws://127.0.0.1:7777/ws?token=…), plus a
// couple of read-only commands that import the server's own parsing code
// directly (no socket round trip needed to tail a transcript).
//
// Run: npx tsx scripts/deckctl.mts <command> [args]
// or via the ~/bin/deckctl wrapper.

import {
  readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, createReadStream,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { ClientMsg, ServerMsg, Effort, Message, ToolQuestion } from '../shared/protocol';
import { CARD_ID_RE, CARD_STATUSES, type CanvasCard, type CardStatus } from '../shared/canvas';
import { buildTaskPrompt, buildContinuePrompt } from '../shared/canvas-prompt';
import { ctxWindow } from '../src/routes/canvas/term-stats-view';
import { mergeBoard } from '../src/routes/canvas/canvas-board';
import { deriveSessionItems } from '../src/routes/canvas/kanban-items';

// --- connection -------------------------------------------------------------

const PORT = Number(process.env.COCKPIT_PORT ?? 7777);
const DEFAULT_TIMEOUT_MS = 15_000;

function readToken(): string {
  if (process.env.COCKPIT_TOKEN) return process.env.COCKPIT_TOKEN;
  try {
    const txt = readFileSync(join(homedir(), '.cockpit-local.env'), 'utf8');
    const m = txt.match(/^(?:export\s+)?COCKPIT_TOKEN=(.*)$/m);
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '');
  } catch { /* file missing — falls through to the "no token" error below */ }
  return '';
}

export function fail(message: string, code = 1): never {
  console.error(`deckctl: ${message}`);
  process.exit(code);
}

// Bootstrap frames arrive as soon as the server accepts the connection —
// server/ws/serve-connection.ts sends caps/claude-auth/busy/… SYNCHRONOUSLY
// in the 'connection' handler, before this module's own 'open' listener ever
// resumes an `await client.ready()` caller. On a fast loopback socket, 'open'
// and that first burst of 'message' events can both fire within the same
// task, ahead of the microtask that resumes `connect()` — a `waitFor(busy)`
// registered only AFTER `await connect()` returns can miss a 'busy' frame
// that already came and went, then time out believing nothing is running
// (the exact "deckctl status: running: 0" symptom this was chasing).
// HISTORY_CAP bounds the buffer for a chatty `wait`/`send` session that stays
// open for the full timeout.
const HISTORY_CAP = 200;

// Exported for scripts/deckctl.test.ts: the connect-time race is only
// reproducible against a real socket, not a pure function — the test spins
// up its own local WebSocketServer and passes a `url` override here instead
// of the real COCKPIT_PORT/token this class uses everywhere else in the file.
export class Client {
  private ws: WebSocket;
  private handlers = new Set<(m: ServerMsg) => void>();
  private openedOrFailed: Promise<void>;
  private history: ServerMsg[] = [];

  constructor(token: string, url = `ws://127.0.0.1:${PORT}/ws?token=${encodeURIComponent(token)}`) {
    this.ws = new WebSocket(url);
    this.openedOrFailed = new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('close', (code) => {
        if (code === 4401) reject(new Error('auth failed — bad or missing COCKPIT_TOKEN'));
      });
      this.ws.once('error', (e) => reject(e instanceof Error ? e : new Error(String(e))));
    });
    this.ws.on('message', (raw) => {
      let m: ServerMsg;
      try { m = JSON.parse(String(raw)); } catch { return; }
      // Buffered BEFORE dispatch, from the very first message this socket
      // ever receives — a matcher registered later (waitFor) still finds it.
      this.history.push(m);
      if (this.history.length > HISTORY_CAP) this.history.shift();
      for (const h of this.handlers) h(m);
    });
  }

  async ready(): Promise<void> {
    await this.openedOrFailed;
  }

  send(msg: ClientMsg): void {
    this.ws.send(JSON.stringify(msg));
  }

  on(handler: (m: ServerMsg) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  // Resolves with the first ServerMsg matching `pred` — checking the history
  // buffer FIRST (a frame that already arrived, e.g. the connect-time race
  // above) before falling back to a live listener + timeout for one that
  // hasn't arrived yet. `fresh` skips the history: an ack for a mutation must be
  // a frame sent AFTER it, not the board/list fetched before it.
  waitFor<T extends ServerMsg>(pred: (m: ServerMsg) => m is T, timeoutMs: number, opts: { fresh?: boolean } = {}): Promise<T | null> {
    const buffered = opts.fresh ? undefined : this.history.find(pred);
    if (buffered) return Promise.resolve(buffered);
    return new Promise((resolve) => {
      const timer = setTimeout(() => { off(); resolve(null); }, timeoutMs);
      const off = this.on((m) => {
        if (pred(m)) { clearTimeout(timer); off(); resolve(m as T); }
      });
    });
  }

  close(): void {
    try { this.ws.close(); } catch { /* already closing */ }
  }
}

async function connect(): Promise<Client> {
  const token = readToken();
  if (!token) fail('no COCKPIT_TOKEN found — set env COCKPIT_TOKEN or add it to ~/.cockpit-local.env');
  const client = new Client(token);
  try {
    await client.ready();
  } catch (e) {
    fail(`can't reach the Deck backend at 127.0.0.1:${PORT} — ${(e as Error).message}`);
  }
  return client;
}

// --- arg parsing --------------------------------------------------------

export interface Flags { [k: string]: string | boolean }

export function parseFlags(args: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[name] = next; i++; }
      else flags[name] = true;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

export function flagStr(flags: Flags, name: string): string | undefined {
  const v = flags[name];
  return typeof v === 'string' ? v : undefined;
}

export function flagNum(flags: Flags, name: string): number | undefined {
  const v = flagStr(flags, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// --- formatting ----------------------------------------------------------

const brtFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});
export function fmtBrt(ms: number): string {
  return `${brtFormatter.format(new Date(ms))} BRT`;
}

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

// One line, no newlines, capped — session/card titles carry raw pasted text
// (attachments, multi-paragraph prompts) that would otherwise blow up a row.
export function oneLine(s: string, max = 70): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// --- session id resolution (direct fs read, no WS needed) ---------------

const UUID_FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/;

async function allSessionIds(): Promise<string[]> {
  const { CONFIG } = await import('../server/config');
  let files: string[];
  try { files = readdirSync(CONFIG.projectsDir); } catch { return []; }
  const ids: string[] = [];
  for (const f of files) {
    const m = UUID_FILE.exec(f);
    if (m) ids.push(m[1]);
  }
  return ids;
}

// Pure prefix match, shared by session-id and card-id resolution: exact match
// wins outright, otherwise a UNIQUE prefix match wins, otherwise ambiguous/none.
export type PrefixMatch = { kind: 'ok'; id: string } | { kind: 'none' } | { kind: 'ambiguous'; matches: string[] };
export function matchByPrefix(ids: string[], prefix: string): PrefixMatch {
  const exact = ids.find((id) => id === prefix);
  if (exact) return { kind: 'ok', id: exact };
  const matches = ids.filter((id) => id.startsWith(prefix));
  if (matches.length === 1) return { kind: 'ok', id: matches[0] };
  if (matches.length === 0) return { kind: 'none' };
  return { kind: 'ambiguous', matches };
}

// Accepts a full uuid or an unambiguous prefix (short id shown by `sessions`/`board`).
async function resolveSessionId(prefix: string): Promise<string> {
  if (UUID_FILE.test(`${prefix}.jsonl`)) return prefix; // already a full uuid
  const ids = await allSessionIds();
  const m = matchByPrefix(ids, prefix);
  if (m.kind === 'ok') return m.id;
  if (m.kind === 'none') fail(`no session matches id prefix "${prefix}"`);
  fail(`ambiguous id prefix "${prefix}" — matches ${m.matches.length} sessions: ${m.matches.map(shortId).join(', ')}`);
}

// --- commands --------------------------------------------------------------

function isServerMsg<T extends ServerMsg['t']>(t: T) {
  return (m: ServerMsg): m is Extract<ServerMsg, { t: T }> => m.t === t;
}

// `busy` only lists THIS connection's own backend process (index.ts on
// COCKPIT_PORT — the listen server deckctl always talks to). A turn started
// on the OTHER Deck process (server/agent.ts, the relay a browser talks to)
// never shows up there, which is exactly the "deckctl says running: 0 while a
// browser turn is live" bug (server/canvas/cv-liveness.ts's registry union,
// pushed here as 'cv-live' off the SAME 'canvas-get' cmdBoard/cmdStatus
// already send). Folding it into `busy`'s keys is what makes `sessions`/
// `status` agree with the kanban on what's actually running.
// `busy` lists running turns by their START key (`new-…`, `cron-…`, a card or flow
// key), which the server never renames to the session id. On a session's first
// turn `busy.keys.includes(sessionId)` is false, so `wait` returned "not running"
// at once and `sessions`/`status` showed it idle. The server sends one `replay`
// per running turn right after `busy`, carrying the sessionId: fold those in.
export async function busySessionIds(client: Client, timeoutMs = 3000): Promise<Set<string>> {
  const busy = await client.waitFor(isServerMsg('busy'), timeoutMs);
  const ids = new Set(busy?.keys ?? []);
  const deadline = Date.now() + 1500;
  for (const key of busy?.keys ?? []) {
    const r = await client.waitFor(
      (m): m is Extract<ServerMsg, { t: 'replay' }> => m.t === 'replay' && m.sessionKey === key,
      Math.max(0, deadline - Date.now()),
    );
    if (r?.sessionId) ids.add(r.sessionId);
  }
  return ids;
}

async function externalLiveIds(client: Client): Promise<string[]> {
  client.send({ t: 'canvas-get' });
  const cvLive = await client.waitFor(isServerMsg('cv-live'), 3000);
  return cvLive?.sessionIds ?? [];
}

async function cmdSessions(flags: Flags, json: boolean): Promise<void> {
  const { listSessions, listArchived } = await import('../server/sessions/index');
  const { sessionUsage } = await import('../server/sessions/ctx-tail');
  const own = flags.all ? [...await listSessions(), ...await listArchived()] : await listSessions();

  const client = await connect();
  const busy = await busySessionIds(client);
  const external = await externalLiveIds(client);
  client.close();
  const busyKeys = new Set([...busy, ...external]);

  const limit = flagNum(flags, 'limit');
  const items = await Promise.all((limit ? own.slice(0, limit) : own).map(async (s) => {
    const running = busyKeys.has(s.id);
    const status = running ? 'running' : s.waiting ? 'awaiting' : 'idle';
    const ctx = (await sessionUsage(s.id))?.ctxTokens;
    return { id: s.id, title: s.title, status, lastActivity: s.mtime, ctxTokens: ctx ?? null, waiting: !!s.waiting };
  }));

  if (json) { console.log(JSON.stringify(items, null, 2)); return; }
  if (!items.length) { console.log('no sessions'); return; }
  for (const it of items) {
    const ctxStr = it.ctxTokens !== null ? `ctx=${Math.round(it.ctxTokens / 1000)}k` : 'ctx=?';
    console.log(`${shortId(it.id)}  ${it.status.padEnd(8)} ${ctxStr.padEnd(9)} ${fmtBrt(it.lastActivity)}  ${oneLine(it.title)}  (${it.id})`);
  }
}

async function cmdRead(id: string, flags: Flags): Promise<void> {
  const full = await resolveSessionId(id);
  const { parseSession } = await import('../server/sessions/parse');
  const { transcriptText } = await import('../server/summary');
  const parsed = await parseSession(full);
  if (!parsed) fail(`session ${full} not found or unparseable`);
  const chars = flagNum(flags, 'chars') ?? 4000;
  const text = transcriptText(parsed.messages, chars);
  console.log(text);
}

async function cmdBoard(json: boolean): Promise<void> {
  const client = await connect();
  client.send({ t: 'canvas-get' });
  const busy = await busySessionIds(client, DEFAULT_TIMEOUT_MS);
  const board = await client.waitFor(isServerMsg('canvas-board'), DEFAULT_TIMEOUT_MS);
  const graph = await client.waitFor(isServerMsg('canvas-graph'), DEFAULT_TIMEOUT_MS);
  // Same signal the browser's kanban reads (kanban-items.ts's `cvLive`) — a
  // session live in the OTHER Deck process (or a cv-shell worker) still needs
  // to land in "doing" here, not just in the live browser tab.
  const cvLive = await client.waitFor(isServerMsg('cv-live'), DEFAULT_TIMEOUT_MS);
  client.close();
  if (!board) fail('backend did not answer canvas-get (canvas-board) — is it deployed with this frame?');

  if (json) { console.log(JSON.stringify({ board: board.board, graph: graph?.graph ?? null }, null, 2)); return; }

  // Every session in scope is ALSO a kanban item (kanban-items.ts
  // deriveSessionItems, #598) — a task card is the minority case, so listing
  // cards alone under-reports the board almost every time.
  const merged = mergeBoard(graph?.graph ?? null, board.board.cards);
  const sessionItems = deriveSessionItems({
    nodes: merged.nodes, edges: merged.edges, cards: board.board.cards, showAutomation: false,
    running: busy, overrides: board.board.sessionStatus, turnStartedAt: {},
    orchestratorSessionId: graph?.graph.orchestrator?.sessionId, cvLive: new Set(cvLive?.sessionIds ?? []),
  });

  const cardsByStatus = new Map<CardStatus, CanvasCard[]>(CARD_STATUSES.map((s) => [s, []]));
  for (const c of board.board.cards) cardsByStatus.get(c.status)?.push(c);
  const itemsByStatus = new Map<CardStatus, typeof sessionItems>(CARD_STATUSES.map((s) => [s, []]));
  for (const i of sessionItems) itemsByStatus.get(i.status)?.push(i);
  for (const status of CARD_STATUSES) {
    const cards = cardsByStatus.get(status) ?? [];
    const items = itemsByStatus.get(status) ?? [];
    console.log(`== ${status} (${cards.length + items.length}) ==`);
    for (const c of cards) {
      const link = c.dfl ? ` dfl:${c.dfl.taskId.slice(0, 8)}` : '';
      console.log(`  ${c.id}  [${c.kind}]${link}  ${oneLine(c.title)}`);
    }
    for (const i of items) {
      console.log(`  ${shortId(i.sessionId)}  [session]${i.needsAttention ? ' !' : ''}  ${oneLine(i.title)}`);
    }
  }
  const sessionNodes = (graph?.graph.nodes ?? []).filter((n) => n.kind === 'session');
  if (sessionNodes.length) {
    console.log(`== sessions (${sessionNodes.length}) ==`);
    for (const n of sessionNodes) {
      console.log(`  ${shortId(n.ref)}  ${n.area ?? '-'}${n.waiting ? ' waiting' : ''}  ${oneLine(n.title)}`);
    }
  }
}

// Shared by `send` and `answer` (an answer is just a normal send — see cmdAnswer):
// queues if the session is mid-turn, otherwise starts a turn directly.
async function sendText(full: string, text: string, flags: Flags): Promise<void> {
  const client = await connect();
  const isBusy = (await busySessionIds(client)).has(full);
  const model = flagStr(flags, 'model');
  const effort = flagStr(flags, 'effort') as Effort | undefined;

  if (isBusy) {
    client.send({ t: 'queue-add', sessionKey: full, sessionId: full, text, model, effort });
    const ack = await client.waitFor((m): m is Extract<ServerMsg, { t: 'queue' | 'queue-reject' }> => m.t === 'queue' || m.t === 'queue-reject', DEFAULT_TIMEOUT_MS);
    client.close();
    if (!ack) fail('no ack from server for queue-add (timeout)');
    if (ack.t === 'queue-reject') fail(`queue-add rejected: ${ack.message}`);
    console.log(`session ${shortId(full)} is busy — queued (queue length: ${ack.items.length})`);
    return;
  }

  client.send({ t: 'send', sessionKey: full, sessionId: full, text, model, effort });
  const ack = await client.waitFor(
    (m): m is Extract<ServerMsg, { t: 'started' | 'send-reject' | 'send-parked' }> =>
      (m.t === 'started' || m.t === 'send-reject' || m.t === 'send-parked') && (m as { sessionKey?: string }).sessionKey === full,
    DEFAULT_TIMEOUT_MS,
  );
  client.close();
  if (!ack) fail('no ack from server for send (timeout)');
  if (ack.t === 'send-reject') fail(`send rejected: ${ack.message}`);
  if (ack.t === 'send-parked') { console.log(`parked (queued for later): ${ack.message}`); return; }
  console.log(`sent — turn started on ${shortId(full)}${ack.model ? ` (model ${ack.model})` : ''}`);
}

async function cmdSend(id: string, text: string, flags: Flags): Promise<void> {
  const full = await resolveSessionId(id);
  return sendText(full, text, flags);
}

// Exit code for "accepted but parked": the server queued the prompt (quota
// window nearly spent, or a big session starting) and its drainer runs it later.
// Not a failure — retrying would start a duplicate session.
export const EXIT_PARKED = 3;

type NewTurn = { kind: 'started'; sessionId: string } | { kind: 'parked'; message: string } | { kind: 'rejected'; message: string } | null;

// Starts a turn on a fresh `new-…` key and waits for whichever answer comes: the
// session id (`system`), a park or a reject. Waiting for `system` alone turned a
// park into "timeout, turn may have failed" (exit 1) 15 s later, and a reject lost
// its message.
export async function startNewTurn(client: Client, sessionKey: string, msg: Omit<Extract<ClientMsg, { t: 'send' }>, 't' | 'sessionKey'>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<NewTurn> {
  client.send({ t: 'send', sessionKey, ...msg });
  const m = await client.waitFor(
    (f): f is Extract<ServerMsg, { t: 'system' | 'send-parked' | 'send-reject' }> =>
      (f.t === 'system' || f.t === 'send-parked' || f.t === 'send-reject') && f.sessionKey === sessionKey,
    timeoutMs,
  );
  if (!m) return null;
  if (m.t === 'system') return { kind: 'started', sessionId: m.sessionId };
  if (m.t === 'send-parked') return { kind: 'parked', message: m.message };
  return { kind: 'rejected', message: m.message };
}

// stderr, not stdout: callers capture stdout as the new session id
// (`new=$(deckctl new … | tail -1)` in ~/bin/marathon-watch).
function parked(client: Client, what: string, message: string): never {
  client.close();
  console.error(`deckctl: parked — ${what} will start when the server drains its queue: ${message}`);
  process.exit(EXIT_PARKED);
}

async function cmdNew(text: string, flags: Flags): Promise<void> {
  if (flagStr(flags, 'cwd')) {
    console.error('deckctl: --cwd is not supported by the current WS protocol (server always spawns in its own fixed workdir) — ignoring');
  }
  const sessionKey = `new-${randomUUID()}`;
  const client = await connect();
  const sys = await startNewTurn(client, sessionKey, { text, model: flagStr(flags, 'model'), effort: flagStr(flags, 'effort') as Effort | undefined });
  if (!sys) { client.close(); fail('no sessionId assigned by server (timeout) — turn may have failed to start'); }
  if (sys.kind === 'rejected') { client.close(); fail(`send rejected: ${sys.message}`); }
  if (sys.kind === 'parked') parked(client, 'the new session', sys.message);
  console.log(sys.sessionId);
  const title = flagStr(flags, 'title');
  if (title) client.send({ t: 'set-meta', sessionId: sys.sessionId, title: title.slice(0, 120) });
  client.close();
}

async function cmdStop(id: string): Promise<void> {
  const full = await resolveSessionId(id);
  const client = await connect();
  client.send({ t: 'stop', sessionKey: full });
  const done = await client.waitFor((m): m is Extract<ServerMsg, { t: 'done' }> => m.t === 'done' && (m.sessionKey === full || m.sessionId === full), 3000);
  client.close();
  console.log(done ? `stopped (${done.stopped ? 'confirmed' : 'turn ended'})` : 'stop sent (no confirmation frame within 3s)');
}

async function cmdWait(id: string, flags: Flags): Promise<void> {
  const full = await resolveSessionId(id);
  const timeoutMs = (flagNum(flags, 'timeout') ?? 15) * 1000;
  const client = await connect();
  if (!(await busySessionIds(client)).has(full)) {
    client.close();
    console.log(`session ${shortId(full)} is not running — nothing to wait for`);
    return;
  }
  const done = await client.waitFor((m): m is Extract<ServerMsg, { t: 'done' }> => m.t === 'done' && (m.sessionKey === full || m.sessionId === full), timeoutMs);
  client.close();
  if (!done) fail(`timed out after ${timeoutMs}ms waiting for the turn to end`);
  console.log(`turn ended — endReason=${done.endReason ?? '?'} cost=${done.costUsd ?? '?'}`);
  const { parseSession } = await import('../server/sessions/parse');
  const { transcriptText } = await import('../server/summary');
  const parsed = await parseSession(done.sessionId);
  if (parsed) console.log(transcriptText(parsed.messages, 2000));
}

// Waits for the frame that proves a mutation landed, or for the handler's
// `error` reply. The old waits matched a frame already in history (the board
// fetched to find the card, the `archived` list from connect or from the hide
// step) and ignored errors, so a failed save printed success and exited 0.
export async function mutationAck<T extends ServerMsg>(client: Client, pred: (m: ServerMsg) => m is T, what: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const m = await client.waitFor(
    (f): f is T | Extract<ServerMsg, { t: 'error' }> => pred(f) || (f.t === 'error' && !f.sessionKey),
    timeoutMs, { fresh: true },
  );
  if (!m) { client.close(); fail(`backend did not confirm ${what} (timeout)`); }
  if (m.t === 'error' && !pred(m)) { client.close(); fail(`${what} failed: ${(m as Extract<ServerMsg, { t: 'error' }>).message}`); }
  return m as T;
}

const archivedWith = (id: string, present: boolean) =>
  (m: ServerMsg): m is Extract<ServerMsg, { t: 'archived' }> => m.t === 'archived' && m.items.some((s) => s.id === id) === present;
const boardWhere = (ok: (cards: CanvasCard[]) => boolean) =>
  (m: ServerMsg): m is Extract<ServerMsg, { t: 'canvas-board' }> => m.t === 'canvas-board' && ok(m.board.cards);

// --- session meta / visibility -------------------------------------------

async function cmdRename(id: string, title: string, flags: Flags): Promise<void> {
  const full = await resolveSessionId(id);
  const summary = flagStr(flags, 'summary');
  const client = await connect();
  client.send({ t: 'set-meta', sessionId: full, title, summary });
  await mutationAck(client, isServerMsg('sessions'), 'rename');
  client.close();
  console.log(`session ${shortId(full)} renamed to "${oneLine(title, 120)}"${summary ? ' (summary updated)' : ''}`);
}

async function cmdHide(id: string): Promise<void> {
  const full = await resolveSessionId(id);
  const client = await connect();
  client.send({ t: 'hide', sessionId: full });
  await mutationAck(client, archivedWith(full, true), 'hide');
  client.close();
  console.log(`session ${shortId(full)} hidden`);
}

async function cmdUnhide(id: string): Promise<void> {
  const full = await resolveSessionId(id);
  const client = await connect();
  client.send({ t: 'unhide', sessionId: full });
  await mutationAck(client, archivedWith(full, false), 'unhide');
  client.close();
  console.log(`session ${shortId(full)} unhidden`);
}

// --- pending questions / answering ---------------------------------------

// A pending AskUserQuestion is the last assistant message's last AskUserQuestion
// tool block, the same lookup the frontend does in AskQuestionCard/visible-blocks
// (isQuestionTool: t.name === 'AskUserQuestion' && t.questions?.length).
async function findPendingQuestion(sessionId: string): Promise<ToolQuestion[] | null> {
  const { parseSession } = await import('../server/sessions/parse');
  const parsed = await parseSession(sessionId);
  if (!parsed) return null;
  const messages = parsed.messages as Message[];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    for (let j = m.blocks.length - 1; j >= 0; j--) {
      const b = m.blocks[j];
      if (b.type === 'tool' && b.tool.name === 'AskUserQuestion' && b.tool.questions?.length) return b.tool.questions;
    }
    return null; // last assistant message has no pending question — nothing to find further back
  }
  return null;
}

interface PendingItem { id: string; title: string; questions: ToolQuestion[] }

async function pendingItems(idFilter?: string): Promise<PendingItem[]> {
  const { listSessions } = await import('../server/sessions/index');
  const own = await listSessions();
  let waiting = own.filter((s) => s.waiting);
  if (idFilter) {
    const full = await resolveSessionId(idFilter);
    waiting = waiting.filter((s) => s.id === full);
  }
  const items: PendingItem[] = [];
  for (const s of waiting) {
    const questions = await findPendingQuestion(s.id);
    if (questions) items.push({ id: s.id, title: s.title, questions });
  }
  return items;
}

async function cmdPending(idArg: string | undefined, json: boolean): Promise<void> {
  const items = await pendingItems(idArg);
  if (json) { console.log(JSON.stringify(items, null, 2)); return; }
  if (!items.length) { console.log(idArg ? 'that session has no pending question' : 'no sessions awaiting an answer'); return; }
  for (const it of items) {
    console.log(`${shortId(it.id)}  ${oneLine(it.title)}`);
    it.questions.forEach((q, qi) => {
      console.log(`  [${qi}] ${q.header ? `${q.header} — ` : ''}${oneLine(q.question, 200)}`);
      q.options.forEach((opt, oi) => {
        console.log(`      ${oi}) ${opt.label}${opt.description ? ` — ${oneLine(opt.description, 120)}` : ''}`);
      });
    });
  }
}

async function cmdAnswer(id: string, answer: string, flags: Flags): Promise<void> {
  const full = await resolveSessionId(id);
  const questions = await findPendingQuestion(full);
  if (!questions) {
    fail(`session ${shortId(full)} has no pending question to answer — falling back to "deckctl send" instead:\n  npx tsx scripts/deckctl.mts send ${id} "${answer}"`);
  }
  const idx = /^\d+$/.test(answer) ? Number(answer) : null;
  let text: string;
  if (idx !== null) {
    if (questions.length > 1) fail(`session ${shortId(full)} has ${questions.length} pending questions — an option index only resolves the first; answer with free text instead (it mirrors what the frontend sends: "<header>: <chosen label>" per question)`);
    const opt = questions[0].options[idx];
    if (!opt) fail(`option index ${idx} out of range — ${questions[0].options.length} option(s): ${questions[0].options.map((o, i) => `${i}) ${o.label}`).join(', ')}`);
    text = `${questions[0].header || questions[0].question}: ${opt.label}`;
  } else {
    text = answer;
  }
  await sendText(full, text, flags);
}

// --- handoff / context size ------------------------------------------------

async function cmdHandoff(id: string): Promise<void> {
  const full = await resolveSessionId(id);
  const client = await connect();
  client.send({ t: 'session-handoff', sessionId: full });
  const result = await client.waitFor(
    (m): m is Extract<ServerMsg, { t: 'handoff-result' }> => m.t === 'handoff-result' && m.sessionId === full,
    30_000,
  );
  if (!result) { client.close(); fail('no handoff-result from server (timeout)'); }
  if (!result.ok) { client.close(); fail(`handoff rejected: ${result.error}`); }

  // Mirror what the frontend does on handoff-result (useCockpit.ts): the WS
  // frame only distills the old session into a memory context and hides it —
  // the fresh chat is a normal 'send' seeded with a resume prompt pointing at
  // that context, same as onNew() + sendPrompt() in the browser.
  const sessionKey = `new-${randomUUID()}`;
  const text = `Retome o trabalho a partir do contexto \`${result.contextId}\`.`;
  const sys = await startNewTurn(client, sessionKey, { text });
  if (!sys) { client.close(); fail('handoff distilled ok but the fresh session never got a sessionId (timeout)'); }
  if (sys.kind === 'rejected') { client.close(); fail(`handoff distilled ok (context ${result.contextId}) but the fresh session was rejected: ${sys.message}`); }
  if (sys.kind === 'parked') parked(client, `the resumed session (context ${result.contextId})`, sys.message);
  const title = result.fromTitle?.trim() ? `${result.fromTitle.trim()} (retomado)` : 'Sessão retomada';
  client.send({ t: 'set-meta', sessionId: sys.sessionId, title });
  client.close();
  console.log(`handoff ok — context ${result.contextId}, new session ${sys.sessionId}`);
}

async function cmdCtx(flags: Flags, json: boolean): Promise<void> {
  const { listSessions } = await import('../server/sessions/index');
  const { sessionUsage } = await import('../server/sessions/ctx-tail');
  const own = await listSessions();
  const items = (await Promise.all(own.map(async (s) => {
      const u = await sessionUsage(s.id);
      const tokens = u?.ctxTokens ?? 0;
      const window = ctxWindow(tokens, u?.requestedModel ?? u?.model ?? undefined);
      return { id: s.id, title: s.title, tokens, window, pct: tokens ? Math.round((tokens / window) * 100) : 0 };
    })))
    .filter((it) => it.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens);
  const limit = flagNum(flags, 'limit');
  const shown = limit ? items.slice(0, limit) : items;

  if (json) { console.log(JSON.stringify(shown, null, 2)); return; }
  if (!shown.length) { console.log('no sessions with observed context usage'); return; }
  for (const it of shown) {
    const windowStr = it.window >= 1_000_000 ? '1M' : '200k';
    console.log(`${shortId(it.id)}  ${String(it.pct).padStart(3)}% of ${windowStr}  (${Math.round(it.tokens / 1000)}k)  ${oneLine(it.title)}`);
  }
}

// --- queue -----------------------------------------------------------------

async function cmdQueue(id: string, json: boolean): Promise<void> {
  const full = await resolveSessionId(id);
  const client = await connect();
  client.send({ t: 'queue-get' });
  const q = await client.waitFor(isServerMsg('queue'), DEFAULT_TIMEOUT_MS);
  client.close();
  if (!q) fail('no ack from server for queue-get (timeout)');
  const items = q.items.filter((it) => it.sessionKey === full);
  if (json) { console.log(JSON.stringify({ items, paused: q.paused }, null, 2)); return; }
  if (!items.length) { console.log(`no queued prompts for session ${shortId(full)}${q.paused ? ' (queue is paused)' : ''}`); return; }
  if (q.paused) console.log('(queue is paused)');
  for (const it of items) {
    console.log(`${it.id}  ${fmtBrt(it.at)}${it.held ? ' held' : ''}${it.model ? ` model=${it.model}` : ''}  ${oneLine(it.text, 100)}`);
  }
}

// --- card commands -----------------------------------------------------

export function newCardIdLocal(title: string): string {
  const slug = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  const id = `${slug || 'card'}-${randomUUID().slice(0, 8)}`;
  return CARD_ID_RE.test(id) ? id : randomUUID().slice(0, 20);
}

async function fetchBoard(client: Client): Promise<{ cards: CanvasCard[] } | null> {
  client.send({ t: 'canvas-get' });
  const board = await client.waitFor(isServerMsg('canvas-board'), DEFAULT_TIMEOUT_MS);
  return board ? board.board : null;
}

export function findCard(cards: CanvasCard[], idPrefix: string): CanvasCard {
  const m = matchByPrefix(cards.map((c) => c.id), idPrefix);
  if (m.kind === 'ok') return cards.find((c) => c.id === m.id)!;
  if (m.kind === 'none') fail(`no card matches id "${idPrefix}"`);
  fail(`ambiguous card id "${idPrefix}" — matches: ${m.matches.join(', ')}`);
}

async function cmdCardAdd(title: string, flags: Flags): Promise<void> {
  const now = Date.now();
  const card: CanvasCard = {
    id: newCardIdLocal(title), title: title.slice(0, 140), prompt: flagStr(flags, 'prompt') ?? '',
    status: 'todo', kind: 'task', contextIds: [], sessionIds: [], createdAt: now, updatedAt: now,
  };
  const client = await connect();
  client.send({ t: 'canvas-card-save', card });
  await mutationAck(client, boardWhere((cards) => cards.some((c) => c.id === card.id)), 'canvas-card-save');
  client.close();
  console.log(`card created: ${card.id}`);
}

async function cmdCardMove(idPrefix: string, status: string): Promise<void> {
  if (!CARD_STATUSES.includes(status as CardStatus)) fail(`invalid status "${status}" — one of: ${CARD_STATUSES.join(', ')}`);
  const client = await connect();
  const board = await fetchBoard(client);
  if (!board) { client.close(); fail('backend did not answer canvas-get (timeout)'); }
  const card = findCard(board.cards, idPrefix);
  client.send({ t: 'canvas-card-save', card: { ...card, status: status as CardStatus, updatedAt: Date.now() } });
  await mutationAck(client, boardWhere((cards) => cards.some((c) => c.id === card.id && c.status === status)), 'canvas-card-save');
  client.close();
  console.log(`card ${card.id} -> ${status}`);
}

async function cmdCardRm(idPrefix: string): Promise<void> {
  const client = await connect();
  const board = await fetchBoard(client);
  if (!board) { client.close(); fail('backend did not answer canvas-get (timeout)'); }
  const card = findCard(board.cards, idPrefix);
  client.send({ t: 'canvas-card-delete', id: card.id });
  await mutationAck(client, boardWhere((cards) => !cards.some((c) => c.id === card.id)), 'canvas-card-delete');
  client.close();
  console.log(`card ${card.id} removed`);
}

async function cmdCardRun(idPrefix: string, flags: Flags): Promise<void> {
  const client = await connect();
  const board = await fetchBoard(client);
  if (!board) { client.close(); fail('backend did not answer canvas-get (timeout)'); }
  const card = findCard(board.cards, idPrefix);
  const forkParent = flagStr(flags, 'fork');

  if (forkParent) {
    const parentSessionId = await resolveSessionId(forkParent);
    const prompt = buildContinuePrompt(card);
    client.send({ t: 'canvas-card-fork', parentSessionId, cardId: card.id, text: prompt });
    const ack = await client.waitFor(
      (m): m is Extract<ServerMsg, { t: 'canvas-card-fork-ok' | 'canvas-card-fork-reject' }> =>
        (m.t === 'canvas-card-fork-ok' || m.t === 'canvas-card-fork-reject') && m.cardId === card.id,
      DEFAULT_TIMEOUT_MS,
    );
    client.close();
    if (!ack) fail('backend not yet deployed with this frame (canvas-card-fork) — no response within timeout');
    if (ack.t === 'canvas-card-fork-reject') fail(`fork rejected: ${ack.message}`);
    console.log(`forked — new session ${ack.forkId}`);
    return;
  }

  // No explicit fork target: replicate the canvas "run" default (a fresh
  // session seeded with the card's prompt+marker; contexts/sessions graph
  // enrichment is skipped here since deckctl has no local canvas graph).
  const prompt = card.reuse?.mode ? buildContinuePrompt(card) : buildTaskPrompt(card, [], []);
  const sessionKey = `new-${randomUUID()}`;
  const sys = await startNewTurn(client, sessionKey, { text: prompt });
  if (!sys) { client.close(); fail('no sessionId assigned by server (timeout)'); }
  if (sys.kind === 'rejected') { client.close(); fail(`send rejected: ${sys.message}`); }
  if (sys.kind === 'parked') parked(client, `card ${card.id}`, sys.message);
  client.send({ t: 'canvas-card-save', card: { ...card, status: 'doing', updatedAt: Date.now() } });
  await mutationAck(client, boardWhere((cards) => cards.some((c) => c.id === card.id && c.status === 'doing')), `canvas-card-save (the turn started on ${sys.sessionId})`);
  client.close();
  console.log(`card ${card.id} running on session ${sys.sessionId}`);
}

// --- status overview -----------------------------------------------------

async function cmdStatus(): Promise<void> {
  const { listSessions } = await import('../server/sessions/index');
  const { sessionUsage } = await import('../server/sessions/ctx-tail');
  const own = await listSessions();

  const client = await connect();
  const busy = await busySessionIds(client);
  client.send({ t: 'canvas-get' });
  const board = await client.waitFor(isServerMsg('canvas-board'), 8000);
  const graph = await client.waitFor(isServerMsg('canvas-graph'), 8000);
  // Live in the OTHER Deck process (or a cv-shell worker) — invisible to
  // `busy`, which only ever lists THIS connection's own backend.
  const cvLive = await client.waitFor(isServerMsg('cv-live'), 8000);
  client.close();

  const cvLiveIds = new Set(cvLive?.sessionIds ?? []);
  const busyKeys = new Set([...busy, ...cvLiveIds]);
  const running = own.filter((s) => busyKeys.has(s.id));
  const awaiting = own.filter((s) => s.waiting);

  console.log(`running: ${running.length}${running.length ? ' — ' + running.map((s) => shortId(s.id)).join(', ') : ''}`);
  console.log(`awaiting input: ${awaiting.length}${awaiting.length ? ' — ' + awaiting.map((s) => shortId(s.id)).join(', ') : ''}`);

  const pending = await pendingItems();
  console.log(`pending questions: ${pending.length}${pending.length ? ' — ' + pending.map((p) => shortId(p.id)).join(', ') : ''}`);

  if (board) {
    // Cards alone under-report the board — most items are sessions that never
    // got an explicit task card (#598); count both like the canvas kanban does.
    const merged = mergeBoard(graph?.graph ?? null, board.board.cards);
    const sessionItems = deriveSessionItems({
      nodes: merged.nodes, edges: merged.edges, cards: board.board.cards, showAutomation: false,
      running: busyKeys, overrides: board.board.sessionStatus, turnStartedAt: {},
      orchestratorSessionId: graph?.graph.orchestrator?.sessionId, cvLive: cvLiveIds,
    });
    const counts = CARD_STATUSES.map((s) => {
      const n = board.board.cards.filter((c) => c.status === s).length + sessionItems.filter((i) => i.status === s).length;
      return `${s}=${n}`;
    }).join(' ');
    console.log(`board: ${counts}`);
  } else {
    console.log('board: no response from backend (canvas-get timed out)');
  }

  // Only RUNNING sessions — an idle session's last-known ctx is stale history,
  // not a live pressure signal, and flagging it would drown the alert in noise
  // (most sessions in this daily driver sit well above 80% once idle).
  const hot = (await Promise.all(running.map(async (s) => ({ s, ctx: (await sessionUsage(s.id))?.ctxTokens }))))
    .filter(({ ctx }) => ctx !== undefined && ctx >= 0.8 * 200_000) // 200k default window; best-effort flag
    .map(({ s }) => s);
  if (hot.length) console.log(`ctx>=80%: ${hot.map((s) => shortId(s.id)).join(', ')}`);

  // ALL own sessions (not just running) at >=70% of their observed window —
  // the handoff/ctx candidates an orchestrator should consider offloading.
  const highCtx = (await Promise.all(own.map(async (s) => ({ s, u: await sessionUsage(s.id) }))))
    .filter(({ u }) => !!u?.ctxTokens && (u.ctxTokens / ctxWindow(u.ctxTokens, u.requestedModel ?? u.model ?? undefined)) * 100 >= 70)
    .map(({ s }) => s);
  console.log(`ctx>=70%: ${highCtx.length}${highCtx.length ? ' — ' + highCtx.map((s) => shortId(s.id)).join(', ') : ''}`);
}

// --- triage ---------------------------------------------------------------
//
// Score every Deck session (active + archived + anything left only on disk in
// session-archivist's index) for keep/purge/review, so cleanup is a repeatable
// command instead of a one-off manual sweep. `scoreSession`/`isNeverPurgeSession`
// are pure and unit-tested below (scripts/deckctl.test.ts); everything else here
// is I/O gathering + the dry-run/--apply command.

export type TriageVerdict = 'KEEP' | 'PURGE' | 'REVIEW';

export interface TriageInput {
  id: string;
  title: string;
  lastActivity: number; // ms epoch — last real activity, not file mtime
  messageCount: number;
  toolCallCount: number; // best-effort; 0 when unknown (still counted as "no evidence of tool use")
  hasHandoff: boolean;
  hasMemoryLeaf: boolean;
  pendingAsk: boolean;
  hasPrMention: boolean;
  editCount: number; // Edit/Write tool calls — proxy for "unique fixes/decisions made here"
  commitCount: number; // git commit / gh pr create|merge / git push in Bash calls
  hasCanvasRefs: boolean; // canvas-refs.json shows this session wrote files or touched memory
  unansweredRequest: boolean; // last real turn is Samuel's, with no assistant text after it
  neverPurge: boolean;
  now?: number; // injectable for tests
}

export interface TriageScore {
  verdict: TriageVerdict;
  score: number;
  signals: string[];
  reason: string;
}

// Weights are additive and small on purpose — the point is ORDERING sessions by
// "how much is there to lose" for a human to skim, not a calibrated probability.
// The hard rules below override the numeric threshold for the cases the brief
// calls out explicitly: never-purge ids, an open question, very recent activity,
// and "fully distilled elsewhere" (handoff + memory + old — the strongest purge
// case even though handoff/memory alone are positive signals everywhere else).
const TRIAGE_WEIGHTS = {
  handoff: 3,
  memoryLeaf: 3,
  prMention: 2,
  shippedWork: 2,
  substantialEdits: 2,
  canvasRefs: 2,
  unansweredRequest: 3,
  thin: -4,
  old: -2,
  recent: 4,
  pendingAsk: 6,
} as const;

const TRIAGE_RECENT_MS = 48 * 60 * 60 * 1000;
const TRIAGE_OLD_MS = 30 * 24 * 60 * 60 * 1000;
const TRIAGE_SUBSTANTIAL_EDITS = 5;
const TRIAGE_KEEP_THRESHOLD = 3;
const TRIAGE_PURGE_THRESHOLD = -3;

export function scoreSession(input: TriageInput): TriageScore {
  const now = input.now ?? Date.now();
  const age = now - input.lastActivity;
  const recent = age < TRIAGE_RECENT_MS;
  const old = age > TRIAGE_OLD_MS;
  const thin = input.messageCount <= 2 && input.toolCallCount === 0 && input.editCount === 0 && input.commitCount === 0;

  const signals: string[] = [];
  let score = 0;
  const add = (w: number, label: string) => { score += w; signals.push(label); };
  if (input.hasHandoff) add(TRIAGE_WEIGHTS.handoff, 'has-handoff');
  if (input.hasMemoryLeaf) add(TRIAGE_WEIGHTS.memoryLeaf, 'has-memory-leaf');
  if (input.hasPrMention) add(TRIAGE_WEIGHTS.prMention, 'pr-mentioned');
  if (input.commitCount > 0) add(TRIAGE_WEIGHTS.shippedWork, 'commit/push');
  if (input.editCount >= TRIAGE_SUBSTANTIAL_EDITS) add(TRIAGE_WEIGHTS.substantialEdits, 'substantial-edits');
  if (input.hasCanvasRefs) add(TRIAGE_WEIGHTS.canvasRefs, 'canvas-refs');
  if (input.unansweredRequest) add(TRIAGE_WEIGHTS.unansweredRequest, 'unanswered-request');
  if (thin) add(TRIAGE_WEIGHTS.thin, 'thin/empty');
  if (old) add(TRIAGE_WEIGHTS.old, 'old(>30d)');
  if (recent) add(TRIAGE_WEIGHTS.recent, 'recent(<48h)');
  if (input.pendingAsk) add(TRIAGE_WEIGHTS.pendingAsk, 'pending-question');

  // Rule 1: hardcoded never-purge (orchestrator ids, cockpit-term-*/main) — KEEP
  // outright, no scoring needed.
  if (input.neverPurge) {
    return { verdict: 'KEEP', score: Infinity, signals: ['never-purge', ...signals], reason: 'hardcoded never-purge (orchestrator or cockpit-term-*/main session)' };
  }
  // Rule 2: an open question is never silently discarded.
  if (input.pendingAsk || input.unansweredRequest) {
    return { verdict: score >= TRIAGE_KEEP_THRESHOLD ? 'KEEP' : 'REVIEW', score, signals, reason: 'has an unanswered question or request — never auto-purged' };
  }
  // Rule 3: very recent activity may still be live work — review, don't purge.
  if (recent) {
    return { verdict: score >= TRIAGE_KEEP_THRESHOLD ? 'KEEP' : 'REVIEW', score, signals, reason: 'active in the last 48h — reviewed, not purged, even if thin' };
  }
  // Rule 4: fully distilled elsewhere (handoff AND memory) AND old — the session
  // copy is redundant. Strongest purge case even though handoff/memory alone
  // lean KEEP everywhere else.
  if (input.hasHandoff && input.hasMemoryLeaf && old) {
    return { verdict: 'PURGE', score, signals: [...signals, 'fully-distilled-elsewhere'], reason: 'context already saved to a handoff and a memory leaf — the session copy is redundant' };
  }
  // Rule 5: numeric threshold on everything else.
  if (score <= TRIAGE_PURGE_THRESHOLD) {
    return { verdict: 'PURGE', score, signals, reason: thin ? 'thin/empty session with no signal worth keeping' : 'low score, no durable signal found' };
  }
  if (score >= TRIAGE_KEEP_THRESHOLD) {
    return { verdict: 'KEEP', score, signals, reason: 'has durable signal (handoff, memory, PR, or recency)' };
  }
  return { verdict: 'REVIEW', score, signals, reason: 'no strong signal either way — needs a human look' };
}

export interface NeverPurgeRecord { id: string; title?: string }

// Hard guard — checked BEFORE any hide/purge call in applyTriage, not just used
// to steer scoring (see brief "Hard constraints": assert this in code).
export function isNeverPurgeSession(rec: NeverPurgeRecord, neverPurgeIds: ReadonlySet<string>): boolean {
  if (neverPurgeIds.has(rec.id)) return true;
  const title = (rec.title ?? '').trim().toLowerCase();
  return title === 'main' || title.startsWith('cockpit-term-');
}

function readNeverPurgeIds(): Set<string> {
  const ids = new Set<string>();
  try {
    const raw = JSON.parse(readFileSync(join(homedir(), '.cockpit', 'orchestrator.json'), 'utf8'));
    if (typeof raw.sessionId === 'string' && raw.sessionId) ids.add(raw.sessionId);
    if (typeof raw.previous === 'string' && raw.previous) ids.add(raw.previous);
  } catch { /* no orchestrator.json — nothing hardcoded to add */ }
  return ids;
}

function readHandoffIds(): Set<string> {
  try {
    return new Set(readdirSync(join(homedir(), '.cockpit', 'handoffs')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));
  } catch { return new Set(); }
}

const ORIGIN_SESSION_RE = /originSessionId:\s*([0-9a-f-]{36})/g;

// A session "covered" by memory is one at least one leaf cites via originSessionId
// in its frontmatter-ish header (see dfl_outro_video_aguia.md for the shape).
function readMemoryLeafOriginIds(): Set<string> {
  const dir = join(homedir(), '.claude', 'projects', '-home-samuel', 'memory');
  const ids = new Set<string>();
  let files: string[];
  try { files = readdirSync(dir); } catch { return ids; }
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    try {
      const text = readFileSync(join(dir, f), 'utf8');
      for (const m of text.matchAll(ORIGIN_SESSION_RE)) ids.add(m[1]);
    } catch { /* unreadable leaf — skip */ }
  }
  return ids;
}

// Tight on purpose: a real PR URL, or a gh/git command that ships work. Loose
// words ("merged", "PR #1" in prose) matched unrelated chatter and kept junk.
const PR_URL_RE = /github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/;
const SHIP_CMD_RE = /\b(?:git\s+(?:commit|push)|gh\s+pr\s+(?:create|merge))\b/;
const PR_CMD_RE = /\bgh\s+pr\s+(?:create|merge)\b/;
const WORK_TOOL_RE = /^(?:Edit|Write|MultiEdit|NotebookEdit)$/;

export interface TranscriptScan {
  prMention: boolean;
  editCount: number;
  commitCount: number;
  toolCallCount: number;
  userTurns: number;
  lastRole: 'user' | 'assistant' | null; // last real turn: Samuel text vs assistant text
}

export function newTranscriptScan(): TranscriptScan {
  return { prMention: false, editCount: 0, commitCount: 0, toolCallCount: 0, userTurns: 0, lastRole: null };
}

// Feeds one JSONL line into the accumulator. Cheap substring gates before
// JSON.parse — a full-corpus scan touches ~1GB of transcripts.
export function feedTranscriptLine(scan: TranscriptScan, line: string): void {
  if (!scan.prMention && PR_URL_RE.test(line)) scan.prMention = true;
  if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) return;
  let o: any;
  try { o = JSON.parse(line); } catch { return; }
  const c = o?.message?.content;
  if (o.type === 'user') {
    const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((x: any) => x?.type === 'text').map((x: any) => x.text).join('') : '';
    if (text.trim() && !o.isMeta) { scan.userTurns++; scan.lastRole = 'user'; }
    return;
  }
  if (o.type !== 'assistant' || !Array.isArray(c)) return;
  for (const b of c) {
    if (b?.type === 'text' && typeof b.text === 'string' && b.text.trim()) scan.lastRole = 'assistant';
    if (b?.type !== 'tool_use') continue;
    scan.toolCallCount++;
    if (WORK_TOOL_RE.test(b.name)) scan.editCount++;
    const cmd = b.name === 'Bash' ? b.input?.command : undefined;
    if (typeof cmd === 'string' && SHIP_CMD_RE.test(cmd)) {
      scan.commitCount++;
      if (PR_CMD_RE.test(cmd)) scan.prMention = true;
    }
  }
}

async function scanTranscriptFile(path: string): Promise<TranscriptScan> {
  const scan = newTranscriptScan();
  try {
    const raw = createReadStream(path);
    const input = path.endsWith('.gz') ? raw.pipe(createGunzip()) : raw;
    input.setEncoding('utf8');
    const rl = createInterface({ input, crlfDelay: Infinity });
    for await (const line of rl) feedTranscriptLine(scan, line);
  } catch { /* unreadable transcript — scan stays at zero */ }
  return scan;
}

let canvasRefsCache: Record<string, any> | null = null;
function hasCanvasRefs(id: string): boolean {
  if (!canvasRefsCache) {
    try { canvasRefsCache = JSON.parse(readFileSync(join(homedir(), '.cockpit', 'canvas-refs.json'), 'utf8')); } catch { canvasRefsCache = {}; }
  }
  const e = canvasRefsCache![id];
  if (!e) return false;
  return Object.keys(e.writes ?? {}).length > 0 || Object.values(e.contexts ?? {}).includes('write');
}

interface RawSessionRecord {
  id: string;
  title: string;
  lastActivity: number;
  messageCount: number;
  toolCallCount: number;
  pendingAsk: boolean;
  source: 'cockpit' | 'index';
  jsonlPath?: string; // present when we can scan the raw transcript for work signals
}

interface IndexEntry {
  id: string;
  title?: string;
  cwd?: string;
  started?: string;
  ended?: string;
  user_turns?: number;
  branches?: string[];
  commands?: string[];
  first_prompt?: string;
  _mtime?: number;
}

// session-archivist's cheap digest index — title/cwd/branch/tool files/usage/
// timestamps, no conversation body. Prefer it over decompressing the .gz.
function readSessionArchiveIndex(): IndexEntry[] {
  const path = join(homedir(), '.claude', 'session-archive', 'INDEX.jsonl');
  let text: string;
  try { text = readFileSync(path, 'utf8'); } catch { return []; }
  const out: IndexEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* corrupt line — skip */ }
  }
  return out;
}

// Merges the cockpit-known list (listSessions + listArchived — the WS/live source
// of truth) with session-archivist's INDEX.jsonl for anything archived-and-purged
// from cockpit that only survives on disk. Degrades gracefully: if the cockpit
// import throws (backend/db unreachable), falls back to INDEX.jsonl alone.
async function gatherRawSessions(): Promise<RawSessionRecord[]> {
  const seen = new Set<string>();
  const records: RawSessionRecord[] = [];
  try {
    const { listSessions, listArchived } = await import('../server/sessions/index');
    const { sessionPath } = await import('../server/sessions/records');
    const own = [...await listSessions(), ...await listArchived()];
    for (const s of own) {
      seen.add(s.id);
      records.push({
        id: s.id, title: s.title, lastActivity: s.mtime, messageCount: s.count,
        toolCallCount: 0, pendingAsk: !!s.waiting, source: 'cockpit', jsonlPath: sessionPath(s.id) ?? undefined,
      });
    }
  } catch (e) {
    console.error(`deckctl: cockpit session source unavailable (${(e as Error).message}) — falling back to session-archivist's INDEX.jsonl only`);
  }
  for (const e of readSessionArchiveIndex()) {
    if (seen.has(e.id)) continue; // already covered by the cockpit-known list
    seen.add(e.id);
    const lastActivity = Date.parse(e.ended || e.started || '') || (e._mtime ? e._mtime * 1000 : Date.now());
    records.push({
      id: e.id,
      title: e.title || e.first_prompt?.slice(0, 60) || 'Sem título',
      lastActivity,
      messageCount: (e.user_turns ?? 0) * 2,
      toolCallCount: e.commands?.length ?? 0,
      pendingAsk: false, // INDEX carries no pendingAsk signal — these are already archived/compressed
      source: 'index',
      jsonlPath: join(homedir(), '.claude', 'session-archive', `${e.id}.jsonl.gz`),
    });
  }
  return records;
}

export interface TriageRow extends TriageScore {
  id: string;
  title: string;
  lastActivity: number;
  source: string;
}

async function buildTriageRows(): Promise<TriageRow[]> {
  const neverPurgeIds = readNeverPurgeIds();
  const handoffIds = readHandoffIds();
  const memoryLeafIds = readMemoryLeafOriginIds();
  const raw = await gatherRawSessions();
  const rows: TriageRow[] = [];
  for (const r of raw) {
    const scan = r.jsonlPath && existsSync(r.jsonlPath) ? await scanTranscriptFile(r.jsonlPath) : null;
    const input: TriageInput = {
      id: r.id, title: r.title, lastActivity: r.lastActivity, messageCount: r.messageCount,
      toolCallCount: Math.max(r.toolCallCount, scan?.toolCallCount ?? 0),
      hasPrMention: scan?.prMention ?? false, editCount: scan?.editCount ?? 0, commitCount: scan?.commitCount ?? 0,
      hasCanvasRefs: hasCanvasRefs(r.id),
      unansweredRequest: !!scan && scan.userTurns > 0 && scan.lastRole === 'user',
      hasHandoff: handoffIds.has(r.id), hasMemoryLeaf: memoryLeafIds.has(r.id),
      pendingAsk: r.pendingAsk, neverPurge: isNeverPurgeSession(r, neverPurgeIds),
    };
    rows.push({ ...scoreSession(input), id: r.id, title: r.title, lastActivity: r.lastActivity, source: r.source });
  }
  return rows.sort((a, b) => a.score - b.score); // most PURGE-leaning first
}

// Deterministic (no AI call) handoff stub for a KEEP session with neither a
// handoff nor a memory leaf yet — built straight from the JSONL's own fields.
// Explicitly marked as an auto-distilled stub so a human knows to double check it
// (contrast with handoffFor() in handoff-from-jsonl.mts, which is AI-summarized).
async function writeHandoffStub(id: string): Promise<string | null> {
  const { sessionPath } = await import('../server/sessions/records');
  const src = sessionPath(id);
  if (!src || !existsSync(src)) return null;

  let title = '';
  let firstUser = '';
  let cwd = '';
  let lastTs = '';
  const files = new Set<string>();
  for (const line of readFileSync(src, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let o: any;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'ai-title' && o.aiTitle) title = o.aiTitle;
    if (typeof o.cwd === 'string' && !cwd) cwd = o.cwd;
    if (typeof o.timestamp === 'string') lastTs = o.timestamp;
    if (!firstUser && o.type === 'user' && o.message) {
      const c = o.message.content;
      firstUser = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((x: any) => x?.type === 'text').map((x: any) => x.text).join(' ') : '';
    }
    if (o.type === 'assistant' && Array.isArray(o.message?.content)) {
      for (const b of o.message.content) {
        if (b?.type === 'tool_use' && /^(Edit|Write|NotebookEdit|MultiEdit)$/.test(b.name) && typeof b.input?.file_path === 'string') {
          files.add(b.input.file_path);
        }
      }
    }
  }

  const dir = join(homedir(), '.cockpit', 'handoffs');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const dest = join(dir, `${id}.md`);
  const body = [
    `# Handoff — ${id}`,
    '',
    '> **Auto-distilled stub** — generated deterministically by `deckctl triage --apply` straight from the raw ' +
      'JSONL (title/cwd/last user message/files touched), NOT hand-written and NOT AI-summarized. Double check it.',
    '',
    '## Objetivo',
    oneLine(firstUser, 300) || title || '—',
    '',
    '## Estado atual',
    `cwd: ${cwd || '—'}`,
    '',
    '## Arquivos e PRs tocados',
    files.size ? [...files].slice(0, 40).map((f) => `- ${f}`).join('\n') : '—',
    '',
    '## Pendências que dependem do Samuel',
    '—',
    '',
    `_Última atividade: ${lastTs || '—'}_`,
  ].join('\n');
  writeFileSync(dest, `${body}\n`, { mode: 0o600 });
  return dest;
}

async function applyTriage(rows: TriageRow[]): Promise<void> {
  const neverPurgeIds = readNeverPurgeIds();
  const handoffIds = readHandoffIds();
  const memoryLeafIds = readMemoryLeafOriginIds();
  const toPurge = rows.filter((r) => r.verdict === 'PURGE');
  const toStub = rows.filter((r) => r.verdict === 'KEEP' && !handoffIds.has(r.id) && !memoryLeafIds.has(r.id));

  for (const r of toPurge) {
    // Hard guard, independent of scoring: refuse a never-purge id/title even if a
    // future scoring change ever let one through as PURGE.
    if (isNeverPurgeSession({ id: r.id, title: r.title }, neverPurgeIds)) {
      console.error(`deckctl: refusing to purge never-purge session ${shortId(r.id)} (scoring bug — this should not happen)`);
      continue;
    }
    const client = await connect();
    client.send({ t: 'hide', sessionId: r.id });
    await mutationAck(client, archivedWith(r.id, true), `hide ${shortId(r.id)}`);
    client.send({ t: 'purge', sessionId: r.id });
    await mutationAck(client, archivedWith(r.id, false), `purge ${shortId(r.id)}`);
    client.close();
    console.log(`purged ${shortId(r.id)}`);
  }

  for (const r of toStub) {
    const path = await writeHandoffStub(r.id);
    console.log(path ? `handoff stub written: ${path}` : `handoff stub SKIPPED for ${shortId(r.id)} (no jsonl on disk)`);
  }

  const reviewed = rows.filter((r) => r.verdict === 'REVIEW').length;
  console.log(`apply done — purged ${toPurge.length}, stubbed ${toStub.length}, reviewed ${reviewed} (no action)`);
}

async function cmdTriage(flags: Flags, json: boolean): Promise<void> {
  let rows = await buildTriageRows();
  const limit = flagNum(flags, 'limit');
  if (limit && flags.apply) fail('--limit cannot be combined with --apply (it would silently narrow the set to the lowest-scored rows)');
  if (limit) rows = rows.slice(0, limit);

  if (flags.apply) {
    await applyTriage(rows);
    return;
  }

  if (json) { console.log(JSON.stringify(rows, null, 2)); return; }

  const counts: Record<TriageVerdict, number> = { KEEP: 0, PURGE: 0, REVIEW: 0 };
  for (const r of rows) counts[r.verdict]++;
  console.log(`KEEP=${counts.KEEP}  PURGE=${counts.PURGE}  REVIEW=${counts.REVIEW}  (total ${rows.length})`);
  for (const verdict of ['PURGE', 'REVIEW', 'KEEP'] as TriageVerdict[]) {
    const group = rows.filter((r) => r.verdict === verdict);
    if (!group.length) continue;
    console.log(`\n== ${verdict} (${group.length}) ==`);
    for (const r of group) {
      const sig = r.signals.slice(0, 2).join(',') || '-';
      console.log(`${shortId(r.id)}  score=${r.score === Infinity ? '∞' : r.score}  [${sig}]  ${oneLine(r.title, 50)}  — ${r.reason}`);
    }
  }
}

// --- main --------------------------------------------------------------

const HELP = `deckctl — orchestrate the Deck canvas from a terminal

Usage: deckctl <command> [args] [--json]

  sessions [--all] [--limit N]              list sessions (id, title, status, ctx, last activity)
  board                                     kanban cards grouped by column + session items
  read <sessionId> [--chars N]              tail of a session's transcript (no WS)
  send <sessionId> "<text>" [--model M] [--effort E]   prompt an existing session (queues if busy)
  new "<text>" [--cwd DIR] [--model M] [--title T]     start a new session, prints its sessionId
  stop <sessionId>                          stop a running turn
  wait <sessionId> [--timeout S]            block until the turn ends (default 15s)
  rename <sessionId> "<title>" [--summary S]   set-meta: title (and optionally summary)
  hide <sessionId>                          hide a session (moves it to archived)
  unhide <sessionId>                        unhide a session
  pending [<sessionId>]                     sessions awaiting an answer (AskUserQuestion) + question/options
  answer <sessionId> <optionIndex|"free text">  answer a pending question (falls back to "send" if none pending)
  handoff <sessionId>                       migrate a heavy session to a fresh chat + handoff summary
  ctx [--limit N]                           sessions sorted by context size, % of window (200k, or 1M if observed)
  queue <sessionId>                         queued prompts for a session
  card add "<title>" [--prompt P]           create a kanban card
  card move <id> <status>                   move a card (todo|doing|review|done)
  card rm <id>                              delete a card
  card run <id> [--fork <parentSessionId>]  run a card (optionally as a fork of an existing session)
  status                                    one-screen overview + alerts (pending questions, hot-context sessions)
  triage [--apply] [--limit N]              score every session KEEP/PURGE/REVIEW (dry-run by default; --apply acts)

Session/card ids accept unambiguous prefixes. Add --json to any read command for raw output.
Exit codes: 0 ok, 1 failure, 3 parked (new/handoff/card run accepted but queued by the server — do not retry).`;

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === '-h') { console.log(HELP); return; }
  const { positional, flags } = parseFlags(rest);
  const json = flags.json === true;

  switch (cmd) {
    case 'sessions': return cmdSessions(flags, json);
    case 'board': return cmdBoard(json);
    case 'read': {
      if (!positional[0]) fail('usage: deckctl read <sessionId> [--chars N]');
      return cmdRead(positional[0], flags);
    }
    case 'send': {
      if (!positional[0] || positional[1] === undefined) fail('usage: deckctl send <sessionId> "<text>"');
      return cmdSend(positional[0], positional[1], flags);
    }
    case 'new': {
      if (!positional[0]) fail('usage: deckctl new "<text>"');
      return cmdNew(positional[0], flags);
    }
    case 'stop': {
      if (!positional[0]) fail('usage: deckctl stop <sessionId>');
      return cmdStop(positional[0]);
    }
    case 'wait': {
      if (!positional[0]) fail('usage: deckctl wait <sessionId> [--timeout S]');
      return cmdWait(positional[0], flags);
    }
    case 'rename': {
      if (!positional[0] || positional[1] === undefined) fail('usage: deckctl rename <sessionId> "<title>" [--summary S]');
      return cmdRename(positional[0], positional[1], flags);
    }
    case 'hide': {
      if (!positional[0]) fail('usage: deckctl hide <sessionId>');
      return cmdHide(positional[0]);
    }
    case 'unhide': {
      if (!positional[0]) fail('usage: deckctl unhide <sessionId>');
      return cmdUnhide(positional[0]);
    }
    case 'pending': return cmdPending(positional[0], json);
    case 'answer': {
      if (!positional[0] || positional[1] === undefined) fail('usage: deckctl answer <sessionId> <optionIndex|"free text">');
      return cmdAnswer(positional[0], positional[1], flags);
    }
    case 'handoff': {
      if (!positional[0]) fail('usage: deckctl handoff <sessionId>');
      return cmdHandoff(positional[0]);
    }
    case 'ctx': return cmdCtx(flags, json);
    case 'queue': {
      if (!positional[0]) fail('usage: deckctl queue <sessionId>');
      return cmdQueue(positional[0], json);
    }
    case 'card': {
      const [sub, ...cargs] = positional;
      if (sub === 'add') {
        if (!cargs[0]) fail('usage: deckctl card add "<title>" [--prompt P]');
        return cmdCardAdd(cargs[0], flags);
      }
      if (sub === 'move') {
        if (!cargs[0] || !cargs[1]) fail('usage: deckctl card move <id> <status>');
        return cmdCardMove(cargs[0], cargs[1]);
      }
      if (sub === 'rm') {
        if (!cargs[0]) fail('usage: deckctl card rm <id>');
        return cmdCardRm(cargs[0]);
      }
      if (sub === 'run') {
        if (!cargs[0]) fail('usage: deckctl card run <id> [--fork <parentSessionId>]');
        return cmdCardRun(cargs[0], flags);
      }
      fail(`unknown card subcommand "${sub}" — add|move|rm|run`);
      return;
    }
    case 'status': return cmdStatus();
    case 'triage': return cmdTriage(flags, json);
    default:
      fail(`unknown command "${cmd}" — run "deckctl --help"`);
  }
}

// Guard so importing this module for tests (scripts/deckctl.test.ts) never runs
// main() against the test runner's own argv/process — only a direct execution
// (npx tsx scripts/deckctl.mts …, or the ~/bin/deckctl wrapper) does.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
}
