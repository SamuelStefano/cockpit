// Tipos compartilhados entre backend (server/) e frontend (src/).
// REGRA (squad L3): types-only — zero import de node:*/fs. O bundle do browser
// importa este arquivo.

export interface ToolDiff {
  path: string;
  old: string;
  new: string;
}

// AskUserQuestion: o modelo pergunta com opções. Como o engine roda `claude -p`
// single-shot (stdin ignorado), NÃO dá pra responder no meio do turno — a UI
// renderiza as opções e a escolha vira o PRÓXIMO prompt (resume). Espelha o
// schema do tool: cada pergunta tem header curto, texto e 2-4 opções.
export interface ToolQuestionOption { label: string; description?: string }
export interface ToolQuestion {
  question: string;
  header: string;
  multiSelect: boolean;
  options: ToolQuestionOption[];
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
  questions?: ToolQuestion[]; // AskUserQuestion: perguntas com opções clicáveis
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

// Veredito do triador (squad de triagem): roteia um prompt enviado com o turno
// atual ocupado. wait=enfileira; answer=subagente responde em bolha à parte;
// priority=interrompe o turno atual; merge=roda em seguida como complemento.
export type TriageAction = 'wait' | 'answer' | 'priority' | 'merge';
export interface TriageVerdict { action: TriageAction; reason: string }

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  ts?: number; // epoch ms; ausente em sessões antigas sem timestamp no JSONL
  triage?: TriageVerdict; // anexado quando a msg foi triada (enviada com turno ocupado)
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  blocks: Block[];
  ts?: number; // epoch ms; ausente em sessões antigas sem timestamp no JSONL
  error?: boolean; // bubble de erro do turno (habilita "tentar novamente" na UI)
  quick?: boolean; // resposta-rápida de subagente (triagem 'answer'); fora do turno principal
  model?: string; // modelo EFETIVO daquele turno; rotula a bolha (evita anacronismo ao trocar modelo mid-thread)
  stats?: TurnBubbleStats; // gasto/tempo/tokens do turno, carimbado no 'done' pra exibição discreta sob a bolha
}

// Métricas do turno carimbadas na bolha do assistant (ground-truth do result do
// CLI). tokens = total faturável do turno (input+output+cache); o usage ao vivo
// mostra só o FILL da janela, não o que o prompt gastou.
export interface TurnBubbleStats { costUsd?: number; durationMs?: number; tokens?: number }

export type Message = UserMessage | AssistantMessage;

export interface SessionMeta {
  id: string;
  title: string;
  relative: string;
  snippet: string;
  summary?: string; // resumo IA do que a sessão fez (gerado ao fim do turno)
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

// Uso do PLANO (claude.ai/settings/usage) — quota global da conta, NÃO contexto
// de chat. utilization = % já consumida da janela. O backend lê isto do endpoint
// OAuth; só os números chegam ao cliente — o token nunca sai do servidor.
export interface PlanUsage {
  fiveHour: number;         // 0..100 — % consumida da janela de 5h (a que o usuário vê)
  sevenDay: number;         // 0..100 — % consumida da janela de 7 dias
  resetsAt: number | null;  // epoch ms do reset da janela de 5h
}

// --- WebSocket protocol ----------------------------------------------------

// Modo de permissão exposto na UI. 'plan' = só planeja (nada executa);
// 'auto' = edita/lê arquivos sem shell (allow-list sem Bash);
// 'acceptEdits' = agente edita E roda comandos. 'bypassPermissions' NÃO é um
// PermMode: é um flag separado (`bypass` no send) atrás do gate admin+env+loopback
// (#94, DR-011), pra o safeMode continuar rejeitando bypass vindo como mode.
export type PermMode = 'plan' | 'auto' | 'acceptEdits';
export interface TurnStats { costUsd?: number; durationMs?: number; numTurns?: number; model?: string }
// Modelo concreto disponível na conta (de /v1/models). O cliente escolhe um id
// específico (ex: claude-opus-4-8); aliases opus/sonnet/haiku ainda valem como
// fallback antes da lista carregar.
export interface ModelInfo { id: string; displayName: string }

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
export interface PluginInfo { name: string; marketplace: string; version: string }

export interface AdminHealth {
  claudeAuth: boolean;         // ~/.claude/.credentials.json existe?
  mcpServers: string[];        // nomes dos MCP configurados (chaves, sem segredo)
  mcp: McpInfo[];              // MCP com transporte (stdio/sse/http), sem segredo
  sshKeys: number;             // chaves privadas em ~/.ssh
  sshHosts: string[];          // aliases Host do ~/.ssh/config (sem chave/host real)
  clis: CliInfo[];             // CLIs no PATH (git/gh/docker/tmux/…)
  installable: string[];       // CLIs que o admin pode instalar (allow-list npm-global)
  envTokens: string[];         // NOMES de env que parecem token/segredo (nunca valor)
  tmuxSessions: string[];      // sessões tmux ativas
  plugins: PluginInfo[];       // plugins instalados (~/.claude/plugins), sem segredo
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

// Conta no painel admin (T3). agentOnline = a VPS daquela conta está pareada agora.
// is_admin é flag de banco (setada só por root); root vem do ENV, não aparece aqui.
export interface AccountSummary { id: string; email: string; isAdmin: boolean; agentOnline: boolean }

export type ClientMsg =
  // skills = ids das skills SELECIONADAS p/ este prompt (subconjunto de SkillMeta.id).
  // Vazio/ausente = todas ativas (default fail-open). O backend nega via permission
  // rule as NÃO-selecionadas (--disallowedTools Skill(id)); ver buildArgs.
  | { t: 'send'; sessionKey: string; sessionId?: string; text: string; msgId?: string; mode?: PermMode; model?: string; maxBudgetUsd?: number; bypass?: boolean; skills?: string[] }
  | { t: 'accounts-list' }
  | { t: 'set-admin'; accountId: string; admin: boolean }
  | { t: 'stop'; sessionKey: string }
  | { t: 'list' }
  | { t: 'open'; sessionId: string }
  | { t: 'open-full'; sessionId: string }
  | { t: 'hide'; sessionId: string }
  | { t: 'unhide'; sessionId: string }
  | { t: 'purge'; sessionId: string }
  | { t: 'set-meta'; sessionId: string; title?: string; summary?: string }
  | { t: 'list-archived' }
  | { t: 'search'; q: string }
  | { t: 'ctx-list' }
  | { t: 'ctx-open'; id: string }
  | { t: 'skill-list' }
  | { t: 'skill-open'; id: string }
  | { t: 'usage-list' }
  | { t: 'admin-health' }
  // Admin write-ops no host (#162, DR-023). Gated por role admin (authorize) e —
  // p/ cli-install (RCE) — por loopback (CONFIG.localOnly) no dispatch. Valor de
  // token nunca volta; só o nome aparece em health.envTokens.
  | { t: 'admin-env-set'; name: string; value: string }
  | { t: 'admin-env-unset'; name: string }
  | { t: 'admin-mcp-add'; name: string; command?: string; url?: string }
  | { t: 'admin-mcp-remove'; name: string }
  | { t: 'admin-cli-install'; name: string }
  | { t: 'upload'; sessionKey: string; name: string; dataB64: string }
  | { t: 'term-open'; termId: string; cols: number; rows: number }
  | { t: 'term-input'; termId: string; data: string }
  | { t: 'term-resize'; termId: string; cols: number; rows: number }
  | { t: 'term-detach'; termId: string }
  | { t: 'term-close'; termId: string }
  | { t: 'term-list' };

// Capabilities da conexão (DR-011). role = papel do ator (hoje sempre admin em
// loopback; Fase 2 vem do token). canBypass = se o servidor permite o toggle de
// bypass (env opt-in + admin + loopback). A UI só mostra o switch quando true.
// role: engine Role no loopback ('admin'|'student'); AccountRole no T3
// ('root'|'admin'|'fellow'). Privilegiado = 'admin'|'root'.
export type Caps = { role: 'root' | 'admin' | 'fellow' | 'student'; canBypass: boolean };

export type ServerMsg =
  | { t: 'caps'; caps: Caps }
  // Esta box tem uma conta Anthropic conectada (OAuth ou ANTHROPIC_API_KEY)? Sem
  // isso o `claude` nem inicia, então a UI avisa que nada vai rodar até conectar.
  // É fato do ENGINE (a VPS), não do viewer — por isso vai à parte do caps, que
  // o agente T3 não reanuncia.
  | { t: 'claude-auth'; ready: boolean }
  // Relay T3 (DR-023): a VPS pareada da conta está online/offline. O browser usa
  // pra mostrar o dashboard de pareamento quando não há agente atendendo.
  | { t: 'agent-online' }
  | { t: 'agent-offline' }
  | { t: 'sessions'; items: SessionMeta[] }
  | { t: 'archived'; items: SessionMeta[] }
  | { t: 'search-results'; q: string; items: SessionMeta[] }
  | { t: 'session-summary'; sessionId: string; summary: string }
  | { t: 'contexts'; items: ContextMeta[] }
  | { t: 'context'; id: string; title: string; body: string }
  | { t: 'models'; models: ModelInfo[] }
  | { t: 'skills'; items: SkillMeta[] }
  | { t: 'skill'; id: string; name: string; body: string }
  | { t: 'uploaded'; name: string; path: string }
  | { t: 'history'; sessionId: string; messages: Message[]; cursor?: string; tokens?: number; full?: boolean; truncated?: boolean }
  | { t: 'busy'; keys: string[] }
  // Eco da mensagem do usuário pra TODOS os clientes (não só quem enviou): sem
  // isto, uma 2ª aba/dispositivo vendo a mesma sessão só recebe a resposta e a
  // bolha do usuário só aparece no F5 (lendo o JSONL). `id` casa o id otimista do
  // remetente p/ dedup; os demais clientes anexam.
  | { t: 'user'; sessionKey: string; id: string; text: string; ts: number }
  // Veredito da triagem de um prompt enviado com o turno ocupado. msgId casa a
  // bolha do usuário p/ anexar o selo; quick-answer chega à parte quando answer.
  | { t: 'triage'; sessionKey: string; msgId?: string; action: TriageAction; reason: string }
  | { t: 'quick-answer'; sessionKey: string; id: string; text: string; ts: number }
  | { t: 'started'; sessionKey: string }
  | { t: 'replay'; sessionKey: string; text: string; thinking: string; tools: ToolCall[]; startedAt?: number }
  | { t: 'system'; sessionKey: string; sessionId: string }
  | { t: 'slash-commands'; items: string[] }
  | { t: 'delta'; sessionKey: string; text: string }
  | { t: 'thinking'; sessionKey: string; text: string }
  | { t: 'tool'; sessionKey: string; tool: ToolCall }
  | { t: 'rate'; resetsAt: number; status: string }
  | { t: 'plan-usage'; usage: PlanUsage }
  | { t: 'usage'; sessionKey: string; tokens: number }
  | { t: 'compact'; sessionKey: string; trigger?: string; preTokens?: number }
  | { t: 'usage-stats'; stats: UsageStats }
  | { t: 'health'; health: AdminHealth }
  | { t: 'admin-op'; ok: boolean; message: string }
  | { t: 'accounts'; accounts: AccountSummary[] }
  | { t: 'stats'; stats: SysStats }
  | { t: 'term-data'; termId: string; data: string }
  | { t: 'term-replay'; termId: string; data: string }
  | { t: 'term-exit'; termId: string }
  | { t: 'terms'; ids: string[] }
  | { t: 'done'; sessionKey: string; sessionId: string; costUsd?: number; durationMs?: number; numTurns?: number; turnTokens?: number; endReason?: string; model?: string; stopped?: boolean }
  | { t: 'error'; sessionKey?: string; message: string };
