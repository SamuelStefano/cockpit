import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ClientMsg, ServerMsg, ToolCall } from '../shared/protocol';
import type { ClaudeEvent } from './engine/events';
import { run, sanitize, type RunHandle } from './engine/claude';
import { CONFIG } from './config';
import { listSessions, listArchived } from './sessions/index';
import { searchSessions } from './sessions/search';
import { listContexts, readContext } from './contexts';
import { listSkills, readSkill } from './skills';
import { saveAttachment } from './attachments';
import { recordUsage, usageStats } from './db';
import { hideSession, unhideSession } from './store';
import { parseSession, ctxTokens, diffOf, planOf } from './sessions/parse';
import { collect } from './stats';
import { openTerm, detachTerm, inputTerm, resizeTerm, closeTerm } from './terminals';

interface Thread {
  handle: RunHandle;
  sessionId?: string;
  costUsd?: number;     // custo real do turno (result.total_cost_usd, ground-truth)
  durationMs?: number;
  numTurns?: number;
  endReason?: string;   // result.subtype: success | error_max_budget | error_max_turns | ...
  // Alvo atual do stream + snapshot acumulado p/ replay no reconnect (#10).
  ws: WebSocket;
  text: string;
  thinking: string;
  tools: ToolCall[];
  toolStart: Map<string, number>; // id -> início, p/ cravar duração no close; morre com o thread
}

const threads = new Map<string, Thread>();

// Lista de slash-commands aprendida do system/init (global ao CLI+skills, não
// varia por sessão). Cacheada em memória pra popular o palette de comandos.
let slashCommands: string[] = [];

export function attachWs(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    send(ws, { t: 'busy', keys: [...threads.keys()] });
    if (slashCommands.length) send(ws, { t: 'slash-commands', items: slashCommands });
    // Reconnect mid-run (#10): re-aponta o stream pra ESTE socket e replaya o
    // snapshot acumulado, pra a UI reconstruir o turno em voo sem duplicar.
    for (const [key, thread] of threads) {
      thread.ws = ws;
      send(ws, { t: 'replay', sessionKey: key, text: thread.text, thinking: thread.thinking, tools: thread.tools });
    }
    collect().then((stats) => send(ws, { t: 'stats', stats })).catch(() => {});

    // terminais anexados por ESTA conexão — pra desanexar no disconnect.
    const myTerms = new Map<string, { onData: (d: string) => void; onExit: () => void }>();

    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try { msg = JSON.parse(String(raw)) as ClientMsg; } catch { return; }
      if (handleTerm(ws, msg, myTerms)) return;
      handle(ws, msg).catch((e) => send(ws, { t: 'error', message: sanitize(String(e?.message ?? e)) }));
    });

    ws.on('close', () => {
      for (const [id, h] of myTerms) detachTerm(id, h.onData, h.onExit);
      myTerms.clear();
    });
  });

  startStatsLoop(wss);
  return wss;
}

// Um timer único: amostra a máquina e empurra pra todos os clientes abertos.
// 2s é suave e mantém o delta de CPU significativo.
function startStatsLoop(wss: WebSocketServer) {
  const tick = async () => {
    if (wss.clients.size === 0) return;
    try {
      const stats = await collect();
      const payload = JSON.stringify({ t: 'stats', stats } satisfies ServerMsg);
      for (const c of wss.clients) if (c.readyState === c.OPEN) c.send(payload);
    } catch { /* best-effort */ }
  };
  setInterval(tick, 2000).unref();
}

// Terminais (síncrono): true se a msg foi de terminal e já tratada.
function handleTerm(
  ws: WebSocket,
  msg: ClientMsg,
  myTerms: Map<string, { onData: (d: string) => void; onExit: () => void }>,
): boolean {
  switch (msg.t) {
    case 'term-open': {
      if (myTerms.has(msg.termId)) return true; // já anexado nesta conexão
      const onData = (data: string) => send(ws, { t: 'term-data', termId: msg.termId, data });
      const onExit = () => { send(ws, { t: 'term-exit', termId: msg.termId }); myTerms.delete(msg.termId); };
      const onReplay = (data: string) => send(ws, { t: 'term-replay', termId: msg.termId, data });
      const ok = openTerm(msg.termId, msg.cols, msg.rows, onData, onExit, onReplay);
      if (ok) myTerms.set(msg.termId, { onData, onExit });
      else send(ws, { t: 'term-exit', termId: msg.termId });
      return true;
    }
    case 'term-input': { inputTerm(msg.termId, msg.data); return true; }
    case 'term-resize': { resizeTerm(msg.termId, msg.cols, msg.rows); return true; }
    case 'term-detach': {
      const h = myTerms.get(msg.termId);
      if (h) { detachTerm(msg.termId, h.onData, h.onExit); myTerms.delete(msg.termId); }
      return true; // sessão tmux fica viva pra reattach
    }
    case 'term-close': {
      const h = myTerms.get(msg.termId);
      if (h) { detachTerm(msg.termId, h.onData, h.onExit); myTerms.delete(msg.termId); }
      closeTerm(msg.termId);
      return true;
    }
  }
  return false;
}

async function handle(ws: WebSocket, msg: ClientMsg) {
  switch (msg.t) {
    case 'list': {
      const items = await listSessions();
      send(ws, { t: 'sessions', items });
      return;
    }
    case 'open': {
      const parsed = await parseSession(msg.sessionId);
      if (!parsed) { send(ws, { t: 'error', message: 'sessão inválida' }); return; }
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages, tokens: parsed.tokens });
      return;
    }
    case 'hide': {
      await hideSession(msg.sessionId);
      send(ws, { t: 'sessions', items: await listSessions() });
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'unhide': {
      await unhideSession(msg.sessionId);
      send(ws, { t: 'sessions', items: await listSessions() });
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'list-archived': {
      send(ws, { t: 'archived', items: await listArchived() });
      return;
    }
    case 'search': {
      send(ws, { t: 'search-results', q: msg.q, items: await searchSessions(msg.q) });
      return;
    }
    case 'ctx-list': {
      send(ws, { t: 'contexts', items: await listContexts() });
      return;
    }
    case 'ctx-open': {
      const c = await readContext(msg.id);
      if (c) send(ws, { t: 'context', id: msg.id, title: c.title, body: c.body });
      return;
    }
    case 'skill-list': {
      send(ws, { t: 'skills', items: await listSkills() });
      return;
    }
    case 'skill-open': {
      const s = await readSkill(msg.id);
      if (s) send(ws, { t: 'skill', id: msg.id, name: s.name, body: s.body });
      return;
    }
    case 'usage-list': {
      send(ws, { t: 'usage-stats', stats: usageStats() });
      return;
    }
    case 'upload': {
      const r = await saveAttachment(msg.sessionKey, msg.name, msg.dataB64);
      if ('error' in r) send(ws, { t: 'error', message: r.error });
      else send(ws, { t: 'uploaded', name: msg.name, path: r.path });
      return;
    }
    case 'stop': {
      threads.get(msg.sessionKey)?.handle.kill();
      return;
    }
    case 'send': {
      startRun(ws, msg.sessionKey, msg.text, msg.sessionId, msg.mode, msg.model, msg.effort, msg.maxBudgetUsd);
      return;
    }
  }
}

function startRun(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string, mode?: string, model?: string, effort?: string, maxBudgetUsd?: number) {
  if (Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) {
    send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' });
    return;
  }
  if (threads.has(sessionKey)) threads.get(sessionKey)!.handle.kill();

  const thread: Thread = { handle: { kill: () => {} }, sessionId: resumeId, ws, text: '', thinking: '', tools: [], toolStart: new Map() };
  threads.set(sessionKey, thread);
  send(thread.ws, { t: 'started', sessionKey });

  thread.handle = run({
    prompt,
    resumeId,
    mode,
    model,
    effort,
    maxBudgetUsd,
    onEvent: (ev) => translate(sessionKey, thread, ev),
    onError: (message) => send(thread.ws, { t: 'error', sessionKey, message }),
    onClose: () => {
      // Se este thread já foi substituído por um run mais novo na mesma key
      // (re-send que matou o anterior), o onClose do antigo NÃO deve mandar um
      // 'done' prematuro nem apagar a entrada do novo run.
      if (threads.get(sessionKey) !== thread) return;
      send(thread.ws, { t: 'done', sessionKey, sessionId: thread.sessionId ?? '', costUsd: thread.costUsd, durationMs: thread.durationMs, numTurns: thread.numTurns, endReason: thread.endReason });
      threads.delete(sessionKey);
    },
  });
}

// Tradução evento NDJSON -> ServerMsg (squad C2/H1: tool por id de correlação).
function translate(sessionKey: string, thread: Thread, ev: ClaudeEvent) {
  const ws = thread.ws;
  switch (ev.type) {
    case 'rate_limit_event': {
      const info = (ev as any).rate_limit_info;
      if (info) send(ws, { t: 'rate', resetsAt: info.resetsAt, status: info.status });
      capture(thread, ev);
      return;
    }
    case 'system': {
      capture(thread, ev);
      const sc = (ev as any).slash_commands;
      if (Array.isArray(sc) && sc.length && sc.join() !== slashCommands.join()) {
        slashCommands = sc;
        send(ws, { t: 'slash-commands', items: slashCommands });
      }
      if (thread.sessionId) send(ws, { t: 'system', sessionKey, sessionId: thread.sessionId });
      return;
    }
    case 'stream_event': {
      const e = (ev as any).event;
      if (e?.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) {
        thread.text += e.delta.text;
        send(ws, { t: 'delta', sessionKey, text: e.delta.text });
      } else if (e?.type === 'content_block_delta' && e.delta?.type === 'thinking_delta' && e.delta.thinking) {
        thread.thinking += e.delta.thinking;
        send(ws, { t: 'thinking', sessionKey, text: e.delta.thinking });
      } else if (e?.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
        emitTool(thread, sessionKey, e.content_block, 'running');
      }
      capture(thread, ev);
      return;
    }
    case 'assistant': {
      const content = (ev as any).message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_use') emitTool(thread, sessionKey, c, 'running');
        }
      }
      const usage = (ev as any).message?.usage;
      const tokens = ctxTokens(usage);
      if (tokens > 0) send(ws, { t: 'usage', sessionKey, tokens });
      recordUsage({
        sessionId: thread.sessionId ?? sessionKey,
        ctxTokens: tokens,
        outputTokens: usage?.output_tokens ?? 0,
        inputTokens: usage?.input_tokens ?? 0,
        cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
        cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
        model: (ev as any).message?.model,
      });
      capture(thread, ev);
      return;
    }
    case 'user': {
      const content = (ev as any).message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_result') closeTool(thread, sessionKey, c);
        }
      }
      return;
    }
    case 'result': {
      const r = ev as any;
      if (typeof r.total_cost_usd === 'number') thread.costUsd = r.total_cost_usd;
      if (typeof r.duration_ms === 'number') thread.durationMs = r.duration_ms;
      if (typeof r.num_turns === 'number') thread.numTurns = r.num_turns;
      if (typeof r.subtype === 'string') thread.endReason = r.subtype;
      capture(thread, ev);
      return;
    }
  }
}

function capture(thread: Thread, ev: ClaudeEvent) {
  const sid = (ev as any).session_id;
  if (sid && !thread.sessionId) thread.sessionId = sid;
}

// Upsert por id no snapshot do thread (mesma lógica do client upsertTool):
// preserva campos do evento running (diff/command) ao mesclar o done.
function snapshotTool(thread: Thread, tool: ToolCall) {
  const i = thread.tools.findIndex((t) => t.id === tool.id);
  if (i === -1) thread.tools.push(tool);
  else thread.tools[i] = { ...thread.tools[i], ...tool };
}

function emitTool(thread: Thread, sessionKey: string, block: any, status: ToolCall['status']) {
  const id = block.id ?? '';
  if (id && !thread.toolStart.has(id)) thread.toolStart.set(id, Date.now());
  const tool: ToolCall = {
    id,
    name: block.name ?? 'tool',
    label: block.name ?? 'tool',
    command: cmdOf(block.input),
    status,
    diff: diffOf(block.name, block.input),
    markdown: planOf(block.name, block.input),
    output: [],
  };
  snapshotTool(thread, tool);
  send(thread.ws, { t: 'tool', sessionKey, tool });
}

function closeTool(thread: Thread, sessionKey: string, c: any) {
  const isErr = !!c.is_error;
  const output = Array.isArray(c.content)
    ? c.content.filter((x: any) => x?.type === 'text').map((x: any) => x.text)
    : typeof c.content === 'string' ? c.content.split('\n') : [];
  const id = c.tool_use_id ?? '';
  const start = thread.toolStart.get(id);
  if (start !== undefined) thread.toolStart.delete(id);
  const tool: ToolCall = {
    id,
    name: 'tool',
    label: 'tool',
    command: '',
    status: isErr ? 'error' : 'done',
    exit: isErr ? 1 : 0,
    output,
    expanded: true,
    durationMs: start !== undefined ? Date.now() - start : undefined,
  };
  snapshotTool(thread, tool);
  send(thread.ws, { t: 'tool', sessionKey, tool });
}

function cmdOf(input: unknown): string {
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    if (typeof o.command === 'string') return o.command;
    if (typeof o.file_path === 'string') return String(o.file_path);
  }
  return '';
}

function send(ws: WebSocket, msg: ServerMsg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
