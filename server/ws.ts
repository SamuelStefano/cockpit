import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ClientMsg, ServerMsg, ToolCall } from '../shared/protocol';
import type { ClaudeEvent } from './engine/events';
import { run, sanitize, type RunHandle } from './engine/claude';
import { CONFIG } from './config';
import { listSessions, listArchived } from './sessions/index';
import { searchSessions } from './sessions/search';
import { listContexts, readContext } from './contexts';
import { hideSession, unhideSession } from './store';
import { parseSession, ctxTokens } from './sessions/parse';
import { collect } from './stats';
import { openTerm, detachTerm, inputTerm, resizeTerm, closeTerm } from './terminals';

interface Thread {
  handle: RunHandle;
  sessionId?: string;
}

const threads = new Map<string, Thread>();

export function attachWs(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    send(ws, { t: 'busy', keys: [...threads.keys()] });
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
    case 'stop': {
      threads.get(msg.sessionKey)?.handle.kill();
      return;
    }
    case 'send': {
      startRun(ws, msg.sessionKey, msg.text, msg.sessionId, msg.mode);
      return;
    }
  }
}

function startRun(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string, mode?: string) {
  if (Buffer.byteLength(prompt) > CONFIG.maxPromptBytes) {
    send(ws, { t: 'error', sessionKey, message: 'prompt grande demais' });
    return;
  }
  if (threads.has(sessionKey)) threads.get(sessionKey)!.handle.kill();

  const thread: Thread = { handle: { kill: () => {} }, sessionId: resumeId };
  threads.set(sessionKey, thread);
  send(ws, { t: 'started', sessionKey });

  thread.handle = run({
    prompt,
    resumeId,
    mode,
    onEvent: (ev) => translate(ws, sessionKey, thread, ev),
    onError: (message) => send(ws, { t: 'error', sessionKey, message }),
    onClose: () => {
      send(ws, { t: 'done', sessionKey, sessionId: thread.sessionId ?? '' });
      threads.delete(sessionKey);
    },
  });
}

// Tradução evento NDJSON -> ServerMsg (squad C2/H1: tool por id de correlação).
function translate(ws: WebSocket, sessionKey: string, thread: Thread, ev: ClaudeEvent) {
  switch (ev.type) {
    case 'rate_limit_event': {
      const info = (ev as any).rate_limit_info;
      if (info) send(ws, { t: 'rate', resetsAt: info.resetsAt, status: info.status });
      capture(thread, ev);
      return;
    }
    case 'system': {
      capture(thread, ev);
      if (thread.sessionId) send(ws, { t: 'system', sessionKey, sessionId: thread.sessionId });
      return;
    }
    case 'stream_event': {
      const e = (ev as any).event;
      if (e?.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) {
        send(ws, { t: 'delta', sessionKey, text: e.delta.text });
      } else if (e?.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
        emitTool(ws, sessionKey, e.content_block, 'running');
      }
      capture(thread, ev);
      return;
    }
    case 'assistant': {
      const content = (ev as any).message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_use') emitTool(ws, sessionKey, c, 'running');
        }
      }
      const tokens = ctxTokens((ev as any).message?.usage);
      if (tokens > 0) send(ws, { t: 'usage', sessionKey, tokens });
      capture(thread, ev);
      return;
    }
    case 'user': {
      const content = (ev as any).message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_result') closeTool(ws, sessionKey, c);
        }
      }
      return;
    }
    case 'result': {
      capture(thread, ev);
      return;
    }
  }
}

function capture(thread: Thread, ev: ClaudeEvent) {
  const sid = (ev as any).session_id;
  if (sid && !thread.sessionId) thread.sessionId = sid;
}

function emitTool(ws: WebSocket, sessionKey: string, block: any, status: ToolCall['status']) {
  const tool: ToolCall = {
    id: block.id ?? '',
    name: block.name ?? 'tool',
    label: block.name ?? 'tool',
    command: cmdOf(block.input),
    status,
    output: [],
  };
  send(ws, { t: 'tool', sessionKey, tool });
}

function closeTool(ws: WebSocket, sessionKey: string, c: any) {
  const isErr = !!c.is_error;
  const output = Array.isArray(c.content)
    ? c.content.filter((x: any) => x?.type === 'text').map((x: any) => x.text)
    : typeof c.content === 'string' ? c.content.split('\n') : [];
  const tool: ToolCall = {
    id: c.tool_use_id ?? '',
    name: 'tool',
    label: 'tool',
    command: '',
    status: isErr ? 'error' : 'done',
    exit: isErr ? 1 : 0,
    output,
    expanded: true,
  };
  send(ws, { t: 'tool', sessionKey, tool });
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
