import type { ClaudeEvent } from '../engine/events';
import { recordUsage } from '../db';
import { ctxTokens } from '../sessions/parse';
import { broadcast } from './broadcast';
import { applySlashCommands } from './slash';
import { setLastRate } from './rate';
import { emitTool, closeTool } from './tools';
import { threads, type Thread } from './runs';

// Tradução evento NDJSON -> ServerMsg (squad C2/H1: tool por id de correlação).
export function translate(sessionKey: string, thread: Thread, ev: ClaudeEvent) {
  // Um re-send mata o run anterior e o substitui na mesma key, mas o kill é
  // assíncrono: o run morrendo ainda drena frames. Sem este guard, deltas/tools
  // do run velho se intercalam com os do novo na mesma sessionKey (o onClose já
  // tem o guard equivalente pro 'done').
  if (threads.get(sessionKey) !== thread) return;
  switch (ev.type) {
    case 'rate_limit_event': {
      const info = (ev as any).rate_limit_info;
      if (info) {
        // O CLI manda resetsAt em epoch SEGUNDOS; a UI compara com Date.now() (ms).
        // Normaliza pra ms aqui (guard: valores < 1e12 são claramente segundos).
        const raw = Number(info.resetsAt) || 0;
        const resetsAt = raw > 0 && raw < 1e12 ? raw * 1000 : raw;
        setLastRate({ resetsAt, status: info.status });
        broadcast({ t: 'rate', resetsAt, status: info.status });
      }
      capture(thread, ev);
      return;
    }
    case 'system': {
      capture(thread, ev);
      const sm = (ev as any).model;
      if (typeof sm === 'string' && sm) thread.model = sm;
      const sc = (ev as any).slash_commands;
      if (Array.isArray(sc) && sc.length) applySlashCommands(sc as string[]);
      if (thread.sessionId) broadcast({ t: 'system', sessionKey, sessionId: thread.sessionId });
      return;
    }
    case 'stream_event': {
      const e = (ev as any).event;
      if (e?.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) {
        thread.text = capTail(thread.text + e.delta.text);
        broadcast({ t: 'delta', sessionKey, text: e.delta.text });
      } else if (e?.type === 'content_block_delta' && e.delta?.type === 'thinking_delta' && e.delta.thinking) {
        thread.thinking = capTail(thread.thinking + e.delta.thinking);
        broadcast({ t: 'thinking', sessionKey, text: e.delta.thinking });
      } else if (e?.type === 'content_block_start' && e.content_block?.type === 'tool_use') {
        emitTool(thread, sessionKey, e.content_block, 'running');
      }
      capture(thread, ev);
      return;
    }
    case 'assistant': {
      const m = (ev as any).message?.model;
      if (typeof m === 'string' && m) thread.model = m;
      const content = (ev as any).message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'tool_use') emitTool(thread, sessionKey, c, 'running');
        }
      }
      capture(thread, ev);
      const usage = (ev as any).message?.usage;
      const tokens = ctxTokens(usage);
      if (tokens > 0) broadcast({ t: 'usage', sessionKey, tokens });
      recordUsage({
        sessionId: thread.sessionId ?? sessionKey,
        ctxTokens: tokens,
        outputTokens: usage?.output_tokens ?? 0,
        inputTokens: usage?.input_tokens ?? 0,
        cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
        cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
        model: (ev as any).message?.model,
      });
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

// O snapshot text/thinking só existe pra replay no reconnect (#10) — a verdade
// completa fica no JSONL. Limita a cauda pra um run de horas com saída enorme
// não inflar a memória do thread nem o payload de replay. Os deltas ao vivo vão
// inteiros pro cliente conectado; só o snapshot é truncado.
const SNAPSHOT_CAP = 512 * 1024;
function capTail(s: string): string {
  return s.length > SNAPSHOT_CAP ? s.slice(s.length - SNAPSHOT_CAP) : s;
}

function capture(thread: Thread, ev: ClaudeEvent) {
  const sid = (ev as any).session_id;
  if (sid && !thread.sessionId) thread.sessionId = sid;
}
