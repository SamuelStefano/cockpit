import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import type { ClaudeEvent } from '../engine/events';

// The sidebar, history and resume all read Claude-shaped JSONL files keyed by a
// uuid (server/sessions). An agent turn writes the same shape so its chat shows
// up and reopens like any other — only the records those readers use.

export function lastUuidOf(path: string): string | null {
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, 'utf8').trimEnd().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const r = JSON.parse(lines[i]);
      if (typeof r?.uuid === 'string') return r.uuid;
    } catch { /* torn line */ }
  }
  return null;
}

const PRIOR_MAX_CHARS = 12_000;

function recordText(r: any): string {
  const c = r?.message?.content;
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return '';
  return c.filter((b: any) => b?.type === 'text' && typeof b.text === 'string').map((b: any) => b.text).join('\n');
}

// The agent has no memory of turns another model ran in this chat (a Claude chat
// switched to Grok when the plan ran out). Its only way to continue the work is
// to read them, newest kept when the chat is long.
export function priorConversation(path: string, max = PRIOR_MAX_CHARS): string {
  if (!existsSync(path)) return '';
  const turns: string[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let r: any;
    try { r = JSON.parse(line); } catch { continue; }
    if (r?.isSidechain || (r?.type !== 'user' && r?.type !== 'assistant')) continue;
    const text = recordText(r).trim();
    if (text) turns.push(`${r.type === 'user' ? 'Person' : 'Assistant'}: ${text}`);
  }
  return turns.join('\n\n').slice(-max);
}

export class TranscriptWriter {
  private parent: string | null;
  private text = '';
  private thinking = '';

  constructor(private readonly path: string, private readonly sessionId: string, private readonly model: string, private readonly cwd: string) {
    this.parent = lastUuidOf(path);
  }

  user(text: string): void {
    this.append({ type: 'user', message: { role: 'user', content: text } });
  }

  observe(ev: ClaudeEvent): void {
    const e = ev as any;
    if (e.type === 'stream_event') {
      const d = e.event?.delta;
      if (d?.type === 'text_delta' && typeof d.text === 'string') this.text += d.text;
      else if (d?.type === 'thinking_delta' && typeof d.thinking === 'string') this.thinking += d.thinking;
      return;
    }
    if (e.type === 'assistant') {
      this.flush();
      this.append({ type: 'assistant', message: { role: 'assistant', id: `msg_${randomUUID()}`, model: this.model, content: e.message?.content ?? [] } });
      return;
    }
    if (e.type === 'user') {
      this.flush();
      this.append({ type: 'user', message: e.message });
    }
  }

  flush(): void {
    const content: unknown[] = [];
    if (this.thinking) content.push({ type: 'thinking', thinking: this.thinking });
    if (this.text) content.push({ type: 'text', text: this.text });
    this.text = '';
    this.thinking = '';
    if (content.length) this.append({ type: 'assistant', message: { role: 'assistant', id: `msg_${randomUUID()}`, model: this.model, content } });
  }

  private append(rec: Record<string, unknown>): void {
    const uuid = randomUUID();
    const line = { ...rec, uuid, parentUuid: this.parent, sessionId: this.sessionId, cwd: this.cwd, timestamp: new Date().toISOString(), isSidechain: false, userType: 'external' };
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      appendFileSync(this.path, JSON.stringify(line) + '\n', { mode: 0o600 });
      this.parent = uuid;
    } catch { /* history is best effort; the live turn already reached the UI */ }
  }
}
