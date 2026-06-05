// Tipos compartilhados entre backend (server/) e frontend (src/).
// REGRA (squad L3): types-only — zero import de node:*/fs. O bundle do browser
// importa este arquivo.

export interface ToolCall {
  id: string; // = tool_use_id (correlação running -> done; squad H1)
  name: string;
  label: string;
  command: string;
  status: 'running' | 'done' | 'error';
  durationMs?: number;
  exit?: number;
  expanded?: boolean;
  output: string[];
}

export interface TextBlock {
  type: 'text';
  md: string;
}

export interface CodeBlock {
  type: 'code';
  lang: string;
  code: string;
}

export interface ToolBlock {
  type: 'tool';
  tool: ToolCall;
}

export type Block = TextBlock | CodeBlock | ToolBlock;

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  blocks: Block[];
}

export type Message = UserMessage | AssistantMessage;

export interface SessionMeta {
  id: string;
  title: string;
  relative: string;
  snippet: string;
  mtime: number;
  count: number;
}

// --- WebSocket protocol ----------------------------------------------------

// Modo de permissão exposto na UI. 'plan' = só planeja (nada executa);
// 'acceptEdits' = agente edita/roda de fato. 'bypassPermissions' NUNCA entra
// (sudo NOPASSWD = RCE root) — a allow-list do backend trava.
export type PermMode = 'plan' | 'acceptEdits';

export interface SysStats {
  cpu: number;                 // 0..100
  mem: { used: number; total: number };       // bytes
  gpu: { util: number; memUsed: number; memTotal: number } | null;
  load: number;
}

export type ClientMsg =
  | { t: 'send'; sessionKey: string; sessionId?: string; text: string; mode?: PermMode }
  | { t: 'stop'; sessionKey: string }
  | { t: 'list' }
  | { t: 'open'; sessionId: string }
  | { t: 'term-open'; termId: string; cols: number; rows: number }
  | { t: 'term-input'; termId: string; data: string }
  | { t: 'term-resize'; termId: string; cols: number; rows: number }
  | { t: 'term-detach'; termId: string }
  | { t: 'term-close'; termId: string };

export type ServerMsg =
  | { t: 'sessions'; items: SessionMeta[] }
  | { t: 'history'; sessionId: string; messages: Message[]; cursor?: string }
  | { t: 'busy'; keys: string[] }
  | { t: 'started'; sessionKey: string }
  | { t: 'system'; sessionKey: string; sessionId: string }
  | { t: 'delta'; sessionKey: string; text: string }
  | { t: 'tool'; sessionKey: string; tool: ToolCall }
  | { t: 'rate'; resetsAt: number; status: string }
  | { t: 'stats'; stats: SysStats }
  | { t: 'term-data'; termId: string; data: string }
  | { t: 'term-exit'; termId: string }
  | { t: 'done'; sessionKey: string; sessionId: string }
  | { t: 'error'; sessionKey?: string; message: string };
