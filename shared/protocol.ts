// Tipos compartilhados entre backend (server/) e frontend (src/).
// REGRA (squad L3): types-only — zero import de node:*/fs. O bundle do browser
// importa este arquivo.

export interface ToolDiff {
  path: string;
  old: string;
  new: string;
}

export interface ToolCall {
  id: string; // = tool_use_id (correlação running -> done; squad H1)
  name: string;
  label: string;
  command: string;
  status: 'running' | 'done' | 'error';
  durationMs?: number;
  exit?: number;
  expanded?: boolean;
  diff?: ToolDiff; // Edit/Write: antes/depois p/ render de diff colorido
  markdown?: string; // corpo rico (ex: plano do ExitPlanMode) renderizado como md
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

// Raciocínio estendido (extended thinking). Só aparece quando o modelo pensa;
// renderizado colapsado por padrão (ruído alto, valor pra debug/transparência).
export interface ThinkingBlock {
  type: 'thinking';
  text: string;
  expanded?: boolean;
}

export type Block = TextBlock | CodeBlock | ToolBlock | ThinkingBlock;

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  ts?: number; // epoch ms; ausente em sessões antigas sem timestamp no JSONL
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  blocks: Block[];
  ts?: number; // epoch ms; ausente em sessões antigas sem timestamp no JSONL
  error?: boolean; // bubble de erro do turno (habilita "tentar novamente" na UI)
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

// Memória do agente surfaceada read-only na aba Contextos.
export interface ContextMeta {
  id: string;
  title: string;
  description: string;
  type: string; // user | feedback | project | reference | memory
  mtime: number;
}

// Skill do agente (dir com SKILL.md) surfaceada read-only na rota Skills.
export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  mtime: number;
}

// Uso/tokens por sessão (time-series agregada do SQLite) — observatório.
export interface SessionUsage {
  sessionId: string;
  ctxTokens: number;      // último contexto observado (fill da janela)
  outputTokens: number;   // soma de saída (proxy de geração/custo)
  samples: number;
  lastTs: number;
  model: string | null;
  costUsd: number;        // custo estimado (preço público aproximado por modelo)
}

export interface DailyUsage {
  day: number;            // epoch ms do início do dia local
  output: number;         // tokens de saída no dia
  cost: number;           // custo estimado no dia (USD)
}

export interface UsageStats {
  sessions: SessionUsage[];
  totalOutput: number;
  totalSamples: number;
  totalCost: number;      // soma do custo estimado de todas as sessões
  series: DailyUsage[];   // buckets diários (últimos N dias) pra trend
}

// --- WebSocket protocol ----------------------------------------------------

// Modo de permissão exposto na UI. 'plan' = só planeja (nada executa);
// 'auto' = edita/lê arquivos sem shell (allow-list sem Bash);
// 'acceptEdits' = agente edita E roda comandos. 'bypassPermissions' NUNCA entra
// (sudo NOPASSWD = RCE root) — a allow-list do backend trava.
export type PermMode = 'plan' | 'auto' | 'acceptEdits';
export interface TurnStats { costUsd?: number; durationMs?: number; numTurns?: number; model?: string }
export type ModelAlias = 'opus' | 'sonnet' | 'haiku';
export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface SysStats {
  cpu: number;                 // 0..100
  mem: { used: number; total: number };       // bytes
  gpu: { util: number; memUsed: number; memTotal: number } | null;
  disk: { used: number; total: number };       // bytes
  load: number;
  // Watchdog (#103): CPU e/ou RAM acima do teto por uma janela contínua. Só
  // alerta — não mata processo nenhum (a sessão real do usuário não é tocada).
  saturated?: { cpu: boolean; mem: boolean; seconds: number };
}

// Health read-only do painel admin (DR-007). Só existência/contagem — nunca
// segredo. Auth-gate fica p/ depois; hoje protegido só por loopback.
export interface McpInfo { name: string; transport: string }
export interface CliInfo { name: string; present: boolean }

export interface AdminHealth {
  claudeAuth: boolean;         // ~/.claude/.credentials.json existe?
  mcpServers: string[];        // nomes dos MCP configurados (chaves, sem segredo)
  mcp: McpInfo[];              // MCP com transporte (stdio/sse/http), sem segredo
  sshKeys: number;             // chaves privadas em ~/.ssh
  sshHosts: string[];          // aliases Host do ~/.ssh/config (sem chave/host real)
  clis: CliInfo[];             // CLIs no PATH (git/gh/docker/tmux/…)
  envTokens: string[];         // NOMES de env que parecem token/segredo (nunca valor)
  tmuxSessions: string[];      // sessões tmux ativas
  sessions: number;            // JSONL no projectsDir
  memories: number;            // .md no memoryDir
  skills: number;              // dirs em skillsDir
  node: string;                // process.version
  uptimeSec: number;           // uptime do backend
  pid: number;
  host: string;
  port: number;
  permissionMode: string;
  disk: { used: number; total: number };
}

export type ClientMsg =
  | { t: 'send'; sessionKey: string; sessionId?: string; text: string; mode?: PermMode; model?: ModelAlias; effort?: EffortLevel; maxBudgetUsd?: number }
  | { t: 'stop'; sessionKey: string }
  | { t: 'list' }
  | { t: 'open'; sessionId: string }
  | { t: 'open-full'; sessionId: string }
  | { t: 'hide'; sessionId: string }
  | { t: 'unhide'; sessionId: string }
  | { t: 'list-archived' }
  | { t: 'search'; q: string }
  | { t: 'ctx-list' }
  | { t: 'ctx-open'; id: string }
  | { t: 'skill-list' }
  | { t: 'skill-open'; id: string }
  | { t: 'usage-list' }
  | { t: 'admin-health' }
  | { t: 'upload'; sessionKey: string; name: string; dataB64: string }
  | { t: 'term-open'; termId: string; cols: number; rows: number }
  | { t: 'term-input'; termId: string; data: string }
  | { t: 'term-resize'; termId: string; cols: number; rows: number }
  | { t: 'term-detach'; termId: string }
  | { t: 'term-close'; termId: string }
  | { t: 'term-list' };

export type ServerMsg =
  | { t: 'sessions'; items: SessionMeta[] }
  | { t: 'archived'; items: SessionMeta[] }
  | { t: 'search-results'; q: string; items: SessionMeta[] }
  | { t: 'contexts'; items: ContextMeta[] }
  | { t: 'context'; id: string; title: string; body: string }
  | { t: 'skills'; items: SkillMeta[] }
  | { t: 'skill'; id: string; name: string; body: string }
  | { t: 'uploaded'; name: string; path: string }
  | { t: 'history'; sessionId: string; messages: Message[]; cursor?: string; tokens?: number; full?: boolean }
  | { t: 'busy'; keys: string[] }
  | { t: 'started'; sessionKey: string }
  | { t: 'replay'; sessionKey: string; text: string; thinking: string; tools: ToolCall[] }
  | { t: 'system'; sessionKey: string; sessionId: string }
  | { t: 'slash-commands'; items: string[] }
  | { t: 'delta'; sessionKey: string; text: string }
  | { t: 'thinking'; sessionKey: string; text: string }
  | { t: 'tool'; sessionKey: string; tool: ToolCall }
  | { t: 'rate'; resetsAt: number; status: string }
  | { t: 'usage'; sessionKey: string; tokens: number }
  | { t: 'usage-stats'; stats: UsageStats }
  | { t: 'health'; health: AdminHealth }
  | { t: 'stats'; stats: SysStats }
  | { t: 'term-data'; termId: string; data: string }
  | { t: 'term-replay'; termId: string; data: string }
  | { t: 'term-exit'; termId: string }
  | { t: 'terms'; ids: string[] }
  | { t: 'done'; sessionKey: string; sessionId: string; costUsd?: number; durationMs?: number; numTurns?: number; endReason?: string; model?: string }
  | { t: 'error'; sessionKey?: string; message: string };
