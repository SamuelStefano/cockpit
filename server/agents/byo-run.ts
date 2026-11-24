import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { RunHandle, RunOpts } from '../engine/claude';
import type { ClaudeEvent } from '../engine/events';
import { CONFIG } from '../config';
import { sessionPath } from '../sessions/records';
import { agentModelId } from '../../shared/agents';
import { byoAgentId, byoModelOf } from '../../shared/byo-providers';
import { byoKeys, type ByoKeyStore } from './byo-keys';
import { ERROR_SHOWN } from './acp-run';
import { TranscriptWriter } from './transcript';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HISTORY_MAX = 60;

export interface ByoDeps {
  fetch: typeof fetch;
  keys: ByoKeyStore;
}

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

function textOfContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((b: any) => (b?.type === 'text' && typeof b.text === 'string' ? b.text : '')).join('');
}

export function readHistory(path: string | null): ChatMessage[] {
  if (!path || !existsSync(path)) return [];
  const out: ChatMessage[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      const r = JSON.parse(line);
      const role = r?.message?.role;
      if (r?.type !== 'user' && r?.type !== 'assistant') continue;
      if (role !== 'user' && role !== 'assistant') continue;
      const content = textOfContent(r.message.content);
      if (content) out.push({ role, content });
    } catch { /* torn line */ }
  }
  return out.slice(-HISTORY_MAX);
}

export function parseSseLine(line: string): { text?: string; thinking?: string; done?: boolean } | null {
  if (!line.startsWith('data:')) return null;
  const data = line.slice(5).trim();
  if (!data) return null;
  if (data === '[DONE]') return { done: true };
  try {
    const delta = JSON.parse(data)?.choices?.[0]?.delta;
    const text = typeof delta?.content === 'string' ? delta.content : undefined;
    const reasoning = delta?.reasoning_content ?? delta?.reasoning;
    const thinking = typeof reasoning === 'string' ? reasoning : undefined;
    return text || thinking ? { text, thinking } : null;
  } catch { return null; }
}

export function httpErrorText(status: number, body: string, key: string): string {
  if (status === 401 || status === 403) return 'a chave foi recusada pelo provedor — confira ou troque em Escolha seus provedores';
  if (status === 402) return 'saldo insuficiente na conta do provedor';
  if (status === 429) return 'limite de uso do provedor atingido, tente de novo em instantes';
  const detail = body.split(key).join('***').replace(/\s+/g, ' ').slice(0, 300);
  return `o provedor respondeu ${status}${detail ? `: ${detail}` : ''}`;
}

export function runByo(opts: RunOpts, deps: ByoDeps = { fetch: globalThis.fetch, keys: byoKeys }): RunHandle {
  const { prompt, resumeId, forkId, model, role, appendSystemPrompt, onEvent, onError, onClose } = opts;
  const target = byoModelOf(model);
  const deckId = (forkId && UUID_RE.test(forkId)) ? forkId : (resumeId && UUID_RE.test(resumeId)) ? resumeId : randomUUID();
  const started = Date.now();
  let closedOnce = false;
  const close = () => { if (!closedOnce) { closedOnce = true; onClose(); } };
  const finish = (subtype: string, isError: boolean) => {
    onEvent({ type: 'result', subtype, is_error: isError, session_id: deckId, duration_ms: Date.now() - started, num_turns: 1, total_cost_usd: 0 } as ClaudeEvent);
  };
  const fail = (msg: string) => { onError(msg); finish(ERROR_SHOWN, true); close(); };
  const noop: RunHandle = { kill: () => {}, send: () => false };

  if (role !== 'admin') { fail('provedores com chave própria só rodam para admin'); return noop; }
  const key = target ? deps.keys.get(target.provider.id) : undefined;
  if (!target || !key) { fail('chave deste provedor não está configurada — Escolha seus provedores'); return noop; }

  const path = sessionPath(deckId);
  const modelId = agentModelId(byoAgentId(target.provider.id, target.model.slug));
  const transcript = path ? new TranscriptWriter(path, deckId, modelId, CONFIG.workdir) : null;
  const history = resumeId && !forkId ? readHistory(path) : forkId && resumeId ? readHistory(sessionPath(resumeId)) : [];
  const messages: ChatMessage[] = [
    ...(appendSystemPrompt?.trim() ? [{ role: 'system' as const, content: appendSystemPrompt }] : []),
    ...history,
    { role: 'user', content: prompt },
  ];
  const abort = new AbortController();
  let ended = false;
  const emit = (ev: ClaudeEvent) => { transcript?.observe(ev); onEvent(ev); };
  const delta = (d: Record<string, string>) => emit({ type: 'stream_event', session_id: deckId, event: { type: 'content_block_delta', delta: d as any } } as ClaudeEvent);

  onEvent({ type: 'system', subtype: 'init', session_id: deckId, model: modelId } as ClaudeEvent);
  transcript?.user(prompt);

  (async () => {
    const res = await deps.fetch(`${target.provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: target.model.id, messages, stream: true }),
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(httpErrorText(res.status, await res.text().catch(() => ''), key));
    if (!res.body) throw new Error('o provedor não enviou resposta');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let done = false;
    const handle = (line: string) => {
      const p = parseSseLine(line.trim());
      if (!p) return;
      if (p.done) done = true;
      if (p.thinking) delta({ type: 'thinking_delta', thinking: p.thinking });
      if (p.text) delta({ type: 'text_delta', text: p.text });
    };
    while (!done) {
      const { value, done: eof } = await reader.read();
      if (eof) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      lines.forEach(handle);
    }
    if (buf) handle(buf);
    if (ended) return;
    ended = true;
    transcript?.flush();
    finish('success', false);
    close();
  })().catch((e) => {
    if (ended) return;
    ended = true;
    transcript?.flush();
    const msg = (e as Error)?.name === 'AbortError' ? 'conexão com o provedor interrompida' : (e as Error)?.message ?? String(e);
    fail(`${target.provider.name}: ${msg.split(key).join('***')}`);
  });

  return {
    kill: () => {
      if (ended) return;
      ended = true;
      abort.abort();
      transcript?.flush();
      finish('cancelled', false);
      close();
    },
    send: () => false,
  };
}
