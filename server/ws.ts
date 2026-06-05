import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { ClientMsg, ServerMsg, ToolCall } from '../shared/protocol';
import type { ClaudeEvent } from './engine/events';
import { run, type RunHandle } from './engine/claude';
import { listSessions } from './sessions/index';
import { parseSession } from './sessions/parse';

interface Thread {
  handle: RunHandle;
  sessionId?: string;
}

const threads = new Map<string, Thread>();

export function attachWs(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    send(ws, { t: 'busy', keys: [...threads.keys()] });

    ws.on('message', (raw) => {
      let msg: ClientMsg;
      try { msg = JSON.parse(String(raw)) as ClientMsg; } catch { return; }
      handle(ws, msg).catch((e) => send(ws, { t: 'error', message: String(e?.message ?? e).slice(0, 200) }));
    });
  });

  return wss;
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
      send(ws, { t: 'history', sessionId: msg.sessionId, messages: parsed.messages });
      return;
    }
    case 'stop': {
      threads.get(msg.sessionKey)?.handle.kill();
      return;
    }
    case 'send': {
      startRun(ws, msg.sessionKey, msg.text, msg.sessionId);
      return;
    }
  }
}

function startRun(ws: WebSocket, sessionKey: string, prompt: string, resumeId?: string) {
  if (threads.has(sessionKey)) threads.get(sessionKey)!.handle.kill();

  const thread: Thread = { handle: { kill: () => {} }, sessionId: resumeId };
  threads.set(sessionKey, thread);
  send(ws, { t: 'started', sessionKey });

  thread.handle = run({
    prompt,
    resumeId,
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
