// Tipos dos eventos NDJSON do `claude -p --output-format stream-json`.
// Verificados ao vivo (claude 2.1.142): rate_limit_event, system/init,
// assistant, result, stream_event. Todos carregam session_id (squad: id na 1ª linha).

export interface RateLimitEvent {
  type: 'rate_limit_event';
  rate_limit_info: { status: string; resetsAt: number; rateLimitType: string };
  session_id: string;
}

export interface SystemEvent {
  type: 'system';
  subtype: string; // 'init' | 'status' | ...
  session_id: string;
  model?: string;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

export interface AssistantEvent {
  type: 'assistant';
  message: { role: 'assistant'; content: ContentBlock[] };
  session_id: string;
}

export interface UserEvent {
  type: 'user';
  message: { role: 'user'; content: ContentBlock[] | string };
  session_id: string;
}

export interface StreamEvent {
  type: 'stream_event';
  event: {
    type: string; // content_block_delta | content_block_start | message_stop | ...
    delta?: { type: string; text?: string };
    content_block?: ContentBlock;
    index?: number;
  };
  session_id: string;
}

export interface ResultEvent {
  type: 'result';
  subtype: string;
  is_error: boolean;
  result?: string;
  session_id: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
}

export type ClaudeEvent =
  | RateLimitEvent
  | SystemEvent
  | AssistantEvent
  | UserEvent
  | StreamEvent
  | ResultEvent
  | { type: string; session_id?: string; [k: string]: unknown };
