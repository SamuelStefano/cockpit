import type { ClaudeEvent, ContentBlock } from '../engine/events';

// Translates ACP session/update notifications into the stream-json events the
// rest of the Deck already renders (ws/translate.ts), so an external agent gets
// streaming text, thinking, tool cards and history without a second UI path.

export interface ToolState { name: string; input: Record<string, unknown>; done: boolean }

function textOf(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(textOf).join('');
  if (content.type === 'text' && typeof content.text === 'string') return content.text;
  if (content.type === 'content') return textOf(content.content);
  if (content.type === 'diff' && typeof content.path === 'string') return `diff ${content.path}`;
  return '';
}

function firstLocation(u: any): string | undefined {
  const l = Array.isArray(u?.locations) ? u.locations[0] : undefined;
  return typeof l?.path === 'string' ? l.path : undefined;
}

// ACP tool kinds → the Deck's tool names, so the card gets the right label,
// command line or diff. Anything unknown keeps the agent's own title.
export function toolBlockOf(u: any): { name: string; input: Record<string, unknown> } {
  const raw = u?.rawInput && typeof u.rawInput === 'object' && !Array.isArray(u.rawInput) ? u.rawInput as Record<string, unknown> : {};
  const title = typeof u?.title === 'string' && u.title ? u.title : 'tool';
  const path = (typeof raw.path === 'string' && raw.path) || (typeof raw.file_path === 'string' && raw.file_path) || firstLocation(u);
  switch (u?.kind) {
    case 'execute': {
      const command = typeof raw.command === 'string' ? raw.command : Array.isArray(raw.command) ? raw.command.join(' ') : title;
      return { name: 'Bash', input: { command, description: title } };
    }
    case 'read': return path ? { name: 'Read', input: { file_path: path } } : { name: title, input: raw };
    case 'edit': {
      const diff = Array.isArray(u?.content) ? u.content.find((c: any) => c?.type === 'diff') : undefined;
      if (diff && typeof diff.path === 'string') return { name: 'Edit', input: { file_path: diff.path, old_string: diff.oldText ?? '', new_string: diff.newText ?? '' } };
      return path ? { name: 'Edit', input: { file_path: path } } : { name: title, input: raw };
    }
    case 'search': return { name: 'Grep', input: { pattern: typeof raw.pattern === 'string' ? raw.pattern : title } };
    case 'fetch': return { name: 'WebFetch', input: { url: typeof raw.url === 'string' ? raw.url : title } };
    default: return { name: title, input: raw };
  }
}

export interface MapCtx {
  sessionId: string;
  tools: Map<string, ToolState>;
}

export function mapUpdate(update: any, ctx: MapCtx): ClaudeEvent[] {
  const sid = ctx.sessionId;
  switch (update?.sessionUpdate) {
    case 'agent_message_chunk': {
      const text = textOf(update.content);
      return text ? [{ type: 'stream_event', session_id: sid, event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } }] : [];
    }
    case 'agent_thought_chunk': {
      const thinking = textOf(update.content);
      return thinking ? [{ type: 'stream_event', session_id: sid, event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking } as any } }] : [];
    }
    case 'tool_call': {
      const id = typeof update.toolCallId === 'string' ? update.toolCallId : '';
      if (!id) return [];
      const block = toolBlockOf(update);
      ctx.tools.set(id, { ...block, done: false });
      const out: ClaudeEvent[] = [{ type: 'assistant', session_id: sid, message: { role: 'assistant', content: [{ type: 'tool_use', id, name: block.name, input: block.input }] } }];
      return out.concat(closeIfFinished(update, id, ctx));
    }
    case 'tool_call_update': {
      const id = typeof update.toolCallId === 'string' ? update.toolCallId : '';
      if (!id) return [];
      if (!ctx.tools.has(id)) return mapUpdate({ ...update, sessionUpdate: 'tool_call' }, ctx);
      return closeIfFinished(update, id, ctx);
    }
    default:
      return [];
  }
}

function closeIfFinished(u: any, id: string, ctx: MapCtx): ClaudeEvent[] {
  const st = ctx.tools.get(id);
  if (!st || st.done || (u.status !== 'completed' && u.status !== 'failed')) return [];
  st.done = true;
  const body = textOf(u.content) || (u.rawOutput !== undefined ? safeJson(u.rawOutput) : '');
  const result: ContentBlock = { type: 'tool_result', tool_use_id: id, content: body, is_error: u.status === 'failed' };
  return [{ type: 'user', session_id: ctx.sessionId, message: { role: 'user', content: [result] } }];
}

function safeJson(v: unknown): string {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v).slice(0, 8000); } catch { return ''; }
}

// Tools left open when the turn ends (cancel, crash) would stay "running" forever.
export function closeDangling(ctx: MapCtx, isError: boolean): ClaudeEvent[] {
  const out: ClaudeEvent[] = [];
  for (const [id, st] of ctx.tools) {
    if (st.done) continue;
    st.done = true;
    out.push({ type: 'user', session_id: ctx.sessionId, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: '', is_error: isError }] } });
  }
  return out;
}

// Same policy the claude engine applies through the permission MCP: plan mode
// never writes, every other mode runs the tool (the session already chose it).
export function permissionOutcome(options: unknown, mode: string | undefined): { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' } {
  const opts = Array.isArray(options) ? options.filter((o: any) => typeof o?.optionId === 'string') as Array<{ optionId: string; kind?: string }> : [];
  const want = mode === 'plan' ? ['reject_once', 'reject_always'] : ['allow_once', 'allow_always'];
  for (const k of want) {
    const o = opts.find((x) => x.kind === k);
    if (o) return { outcome: 'selected', optionId: o.optionId };
  }
  return { outcome: 'cancelled' };
}

export function resultSubtype(stopReason: unknown): { subtype: string; isError: boolean } {
  switch (stopReason) {
    case 'end_turn': return { subtype: 'success', isError: false };
    case 'max_turn_requests': return { subtype: 'error_max_turns', isError: true };
    case 'cancelled': return { subtype: 'cancelled', isError: false };
    case 'refusal': return { subtype: 'refusal', isError: true };
    case 'max_tokens': return { subtype: 'success', isError: false };
    default: return { subtype: 'success', isError: false };
  }
}
