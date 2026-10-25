#!/usr/bin/env node
// Team MCP for a Equipe bot's `claude -p` turn: lets the bot see its team and send
// a message to another bot. It never talks to the backend over the network — it
// drops one JSON file per message in the outbox (tmp + rename), the backend claims
// it, applies the brakes, delivers, and appends the outcome to the log, which this
// server then waits on briefly to tell the model what happened.
//
// Zero dependencies, same reason as permission-mcp.mjs: spawned once per bot turn.

import { readFileSync, writeFileSync, renameSync, mkdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const BOT = arg('bot', '');
const HOP = Math.max(0, Number.parseInt(arg('hop', '0'), 10) || 0);
const TEAM = arg('team', '');
const OUTBOX = arg('outbox', '');
const LOG = arg('log', '');
const PAUSE = arg('pause', '');
const WAIT_MS = Math.max(0, Number.parseInt(arg('wait-ms', '5000'), 10) || 0);
const MAX_HOPS = 6;
const MAX_TEXT_BYTES = 8 * 1024;
const TAIL_BYTES = 256 * 1024;

function readJson(path, fallback) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

const team = () => { const t = readJson(TEAM, []); return Array.isArray(t) ? t : []; };
const paused = () => readJson(PAUSE, {})?.paused === true;

function reply(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}
const text = (s, isError = false) => ({ content: [{ type: 'text', text: s }], ...(isError ? { isError: true } : {}) });

const TOOLS = [
  {
    name: 'team_list',
    description: 'Lista a equipe de bots do Deck: nome, cargo, chefe e quem é você.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'team_send',
    description: 'Manda uma mensagem a outro bot da equipe, pelo nome. Ela vira um turno na conversa dele. Use com parcimônia: cada mensagem custa um turno inteiro do destinatário.',
    inputSchema: {
      type: 'object',
      properties: { to: { type: 'string', description: 'nome do bot' }, text: { type: 'string', description: 'a mensagem' } },
      required: ['to', 'text'],
    },
  },
];

function listTeam() {
  const all = team();
  if (!all.length) return 'A equipe está vazia.';
  const byId = new Map(all.map((b) => [b.id, b]));
  return all.map((b) => {
    const parts = [`${b.name}${b.id === BOT ? ' (você)' : ''}${b.primary ? ' — principal' : ''}`];
    if (b.label) parts.push(`cargo: ${b.label}`);
    const boss = b.parentId && byId.get(b.parentId);
    if (boss) parts.push(`chefe: ${boss.name}`);
    return `- ${parts.join('; ')}`;
  }).join('\n');
}

function tailLog() {
  try {
    const size = statSync(LOG).size;
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    const fd = openSync(LOG, 'r');
    try { readSync(fd, buf, 0, buf.length, start); } finally { closeSync(fd); }
    return buf.toString('utf8');
  } catch { return ''; }
}

function outcomeOf(id) {
  for (const line of tailLog().split('\n').reverse()) {
    if (!line.includes(id)) continue;
    try { const m = JSON.parse(line); if (m.id === id) return m; } catch { /* torn line */ }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function awaitOutcome(id) {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const m = outcomeOf(id);
    if (m) return m;
    await sleep(250);
  }
  return null;
}

function describe(m, name) {
  if (!m) return `Mensagem enfileirada para ${name}; a entrega acontece em instantes.`;
  if (m.status === 'delivered') return `Entregue a ${name}. A resposta dele aparece na conversa dele, não aqui — não fique esperando nem mande de novo.`;
  if (m.status === 'queued') return `Enfileirada: ${name} está ocupado e recebe quando terminar o turno atual.`;
  if (m.status === 'blocked') return `Bloqueada (${m.reason ?? 'freio da equipe'}). Não tente de novo agora; siga sem essa mensagem.`;
  return `Não entregue (${m.reason ?? 'falha'}).`;
}

async function send(args) {
  const to = typeof args.to === 'string' ? args.to.trim() : '';
  const body = typeof args.text === 'string' ? args.text : '';
  if (!BOT || !OUTBOX) return text('Equipe indisponível neste turno.', true);
  const all = team();
  const target = all.find((b) => b.name.toLowerCase() === to.toLowerCase());
  if (!target) return text(`Não existe bot "${to}" na equipe. Use team_list.`, true);
  if (target.id === BOT) return text('Você não pode mandar mensagem pra si mesmo.', true);
  if (!body.trim()) return text('Mensagem vazia.', true);
  if (Buffer.byteLength(body) > MAX_TEXT_BYTES) return text('Mensagem passa de 8KB; resuma.', true);
  const hop = HOP + 1;
  const id = `m${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;
  mkdirSync(OUTBOX, { recursive: true });
  const tmp = join(OUTBOX, `.${id}.tmp`);
  writeFileSync(tmp, JSON.stringify({ id, from: BOT, to: target.id, text: body, hop, ts: Date.now() }));
  renameSync(tmp, join(OUTBOX, `${id}.json`));
  // The backend has the final word and logs the cut; this only spares the wait.
  if (paused()) return text(describe({ status: 'blocked', reason: 'equipe pausada' }, target.name));
  if (hop >= MAX_HOPS) return text(describe({ status: 'blocked', reason: `cadeia longa demais (${hop} saltos)` }, target.name));
  return text(describe(await awaitOutcome(id), target.name));
}

async function onMessage(msg) {
  if (typeof msg.id === 'undefined') return;
  switch (msg.method) {
    case 'initialize':
      return reply(msg.id, {
        protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'deck-team', version: '1.0.0' },
      });
    case 'tools/list':
      return reply(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = msg.params?.name;
      const args = msg.params?.arguments ?? {};
      try {
        if (name === 'team_list') return reply(msg.id, text(listTeam()));
        if (name === 'team_send') return reply(msg.id, await send(args));
        return reply(msg.id, text(`Tool desconhecida: ${name}`, true));
      } catch (e) {
        return reply(msg.id, text(`Falhou: ${e instanceof Error ? e.message : String(e)}`, true));
      }
    }
    default:
      return reply(msg.id, {});
  }
}

let pending = 0;
let ended = false;
const maybeExit = () => { if (ended && pending === 0) process.exit(0); };

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    pending++;
    Promise.resolve(onMessage(msg)).catch(() => {}).finally(() => { pending--; maybeExit(); });
  }
});
process.stdin.on('end', () => { ended = true; maybeExit(); });
