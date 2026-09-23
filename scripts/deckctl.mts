#!/usr/bin/env -S npx tsx
// deckctl: command-line orchestrator for the /canvas page — speaks the SAME
// WebSocket protocol the browser uses (ws://127.0.0.1:7777/?token=…), plus a
// couple of read-only commands that import the server's own parsing code
// directly (no socket round trip needed to tail a transcript).
//
// Run: npx tsx scripts/deckctl.mts <command> [args]
// or via the ~/bin/deckctl wrapper.

import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { ClientMsg, ServerMsg, Effort } from '../shared/protocol';
import { CARD_ID_RE, CARD_STATUSES, type CanvasCard, type CardStatus } from '../shared/canvas';
import { buildTaskPrompt, buildContinuePrompt } from '../shared/canvas-prompt';

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

class Client {
  private ws: WebSocket;
  private handlers = new Set<(m: ServerMsg) => void>();
  private openedOrFailed: Promise<void>;

  constructor(token: string) {
    const url = `ws://127.0.0.1:${PORT}/ws?token=${encodeURIComponent(token)}`;
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

  // Resolves with the first ServerMsg matching `pred`, or null on timeout.
  waitFor<T extends ServerMsg>(pred: (m: ServerMsg) => m is T, timeoutMs: number): Promise<T | null> {
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

async function cmdSessions(flags: Flags, json: boolean): Promise<void> {
  const { listSessions, listArchived } = await import('../server/sessions/index');
  const { lastUsageOf } = await import('../server/db');
  const own = flags.all ? [...await listSessions(), ...await listArchived()] : await listSessions();

  const client = await connect();
  const busy = await client.waitFor(isServerMsg('busy'), 3000);
  client.close();
  const busyKeys = new Set(busy?.keys ?? []);

  const limit = flagNum(flags, 'limit');
  const items = (limit ? own.slice(0, limit) : own).map((s) => {
    const running = busyKeys.has(s.id);
    const status = running ? 'running' : s.waiting ? 'awaiting' : 'idle';
    const ctx = lastUsageOf(s.id)?.ctxTokens;
    return { id: s.id, title: s.title, status, lastActivity: s.mtime, ctxTokens: ctx ?? null, waiting: !!s.waiting };
  });

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
  const board = await client.waitFor(isServerMsg('canvas-board'), DEFAULT_TIMEOUT_MS);
  const graph = await client.waitFor(isServerMsg('canvas-graph'), DEFAULT_TIMEOUT_MS);
  client.close();
  if (!board) fail('backend did not answer canvas-get (canvas-board) — is it deployed with this frame?');

  if (json) { console.log(JSON.stringify({ board: board.board, graph: graph?.graph ?? null }, null, 2)); return; }

  const byStatus = new Map<CardStatus, CanvasCard[]>(CARD_STATUSES.map((s) => [s, []]));
  for (const c of board.board.cards) byStatus.get(c.status)?.push(c);
  for (const status of CARD_STATUSES) {
    const cards = byStatus.get(status) ?? [];
    console.log(`== ${status} (${cards.length}) ==`);
    for (const c of cards) {
      const link = c.dfl ? ` dfl:${c.dfl.taskId.slice(0, 8)}` : '';
      console.log(`  ${c.id}  [${c.kind}]${link}  ${oneLine(c.title)}`);
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

async function cmdSend(id: string, text: string, flags: Flags): Promise<void> {
  const full = await resolveSessionId(id);
  const client = await connect();
  const busy = await client.waitFor(isServerMsg('busy'), 3000);
  const isBusy = !!busy?.keys.includes(full);
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

async function cmdNew(text: string, flags: Flags): Promise<void> {
  if (flagStr(flags, 'cwd')) {
    console.error('deckctl: --cwd is not supported by the current WS protocol (server always spawns in its own fixed workdir) — ignoring');
  }
  const sessionKey = `new-${randomUUID()}`;
  const client = await connect();
  client.send({ t: 'send', sessionKey, text, model: flagStr(flags, 'model'), effort: flagStr(flags, 'effort') as Effort | undefined });
  const sys = await client.waitFor((m): m is Extract<ServerMsg, { t: 'system' }> => m.t === 'system' && m.sessionKey === sessionKey, DEFAULT_TIMEOUT_MS);
  if (!sys) { client.close(); fail('no sessionId assigned by server (timeout) — turn may have failed to start'); }
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
  const busy = await client.waitFor(isServerMsg('busy'), 3000);
  if (!busy?.keys.includes(full)) {
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
  const board = await client.waitFor(isServerMsg('canvas-board'), DEFAULT_TIMEOUT_MS);
  client.close();
  if (!board) fail('backend did not answer canvas-card-save (timeout)');
  console.log(`card created: ${card.id}`);
}

async function cmdCardMove(idPrefix: string, status: string): Promise<void> {
  if (!CARD_STATUSES.includes(status as CardStatus)) fail(`invalid status "${status}" — one of: ${CARD_STATUSES.join(', ')}`);
  const client = await connect();
  const board = await fetchBoard(client);
  if (!board) { client.close(); fail('backend did not answer canvas-get (timeout)'); }
  const card = findCard(board.cards, idPrefix);
  client.send({ t: 'canvas-card-save', card: { ...card, status: status as CardStatus, updatedAt: Date.now() } });
  const ack = await client.waitFor(isServerMsg('canvas-board'), DEFAULT_TIMEOUT_MS);
  client.close();
  if (!ack) fail('backend did not confirm canvas-card-save (timeout)');
  console.log(`card ${card.id} -> ${status}`);
}

async function cmdCardRm(idPrefix: string): Promise<void> {
  const client = await connect();
  const board = await fetchBoard(client);
  if (!board) { client.close(); fail('backend did not answer canvas-get (timeout)'); }
  const card = findCard(board.cards, idPrefix);
  client.send({ t: 'canvas-card-delete', id: card.id });
  const ack = await client.waitFor(isServerMsg('canvas-board'), DEFAULT_TIMEOUT_MS);
  client.close();
  if (!ack) fail('backend did not confirm canvas-card-delete (timeout)');
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
  client.send({ t: 'send', sessionKey, text: prompt });
  const sys = await client.waitFor((m): m is Extract<ServerMsg, { t: 'system' }> => m.t === 'system' && m.sessionKey === sessionKey, DEFAULT_TIMEOUT_MS);
  if (!sys) { client.close(); fail('no sessionId assigned by server (timeout)'); }
  client.send({ t: 'canvas-card-save', card: { ...card, status: 'doing', updatedAt: Date.now() } });
  await client.waitFor(isServerMsg('canvas-board'), DEFAULT_TIMEOUT_MS);
  client.close();
  console.log(`card ${card.id} running on session ${sys.sessionId}`);
}

// --- status overview -----------------------------------------------------

async function cmdStatus(): Promise<void> {
  const { listSessions } = await import('../server/sessions/index');
  const { lastUsageOf } = await import('../server/db');
  const own = await listSessions();

  const client = await connect();
  const busy = await client.waitFor(isServerMsg('busy'), 3000);
  client.send({ t: 'canvas-get' });
  const board = await client.waitFor(isServerMsg('canvas-board'), 8000);
  client.close();

  const busyKeys = new Set(busy?.keys ?? []);
  const running = own.filter((s) => busyKeys.has(s.id));
  const awaiting = own.filter((s) => s.waiting);

  console.log(`running: ${running.length}${running.length ? ' — ' + running.map((s) => shortId(s.id)).join(', ') : ''}`);
  console.log(`awaiting input: ${awaiting.length}${awaiting.length ? ' — ' + awaiting.map((s) => shortId(s.id)).join(', ') : ''}`);

  if (board) {
    const counts = CARD_STATUSES.map((s) => `${s}=${board.board.cards.filter((c) => c.status === s).length}`).join(' ');
    console.log(`board: ${counts}`);
  } else {
    console.log('board: no response from backend (canvas-get timed out)');
  }

  // Only RUNNING sessions — an idle session's last-known ctx is stale history,
  // not a live pressure signal, and flagging it would drown the alert in noise
  // (most sessions in this daily driver sit well above 80% once idle).
  const hot = running.filter((s) => {
    const ctx = lastUsageOf(s.id)?.ctxTokens;
    return ctx !== undefined && ctx >= 0.8 * 200_000; // 200k default window; best-effort flag
  });
  if (hot.length) console.log(`ctx>=80%: ${hot.map((s) => shortId(s.id)).join(', ')}`);
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
  card add "<title>" [--prompt P]           create a kanban card
  card move <id> <status>                   move a card (todo|doing|review|done)
  card rm <id>                              delete a card
  card run <id> [--fork <parentSessionId>]  run a card (optionally as a fork of an existing session)
  status                                    one-screen overview + alerts

Session/card ids accept unambiguous prefixes. Add --json to any read command for raw output.`;

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
