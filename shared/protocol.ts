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
  todos?: ToolTodo[]; // TodoWrite: lista de tarefas (pending/in_progress/completed)
  output: string[];
}

export interface ToolTodo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string; // forma gerúndio mostrada enquanto in_progress ("Rodando testes")
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
export interface TurnBubbleStats { costUsd?: number; durationMs?: number; tokens?: number; inputTokens?: number; outputTokens?: number }

// Marca inline na thread onde o CLI auto-compactou o contexto (DR-012). Não é
// turno: é um divisor que explica o salto no medidor e que o pré-compactação está
// em "ver tudo". preTokens = tamanho da janela antes do corte.
export interface CompactMessage {
  id: string;
  role: 'compact';
  trigger?: string; // 'auto' | 'manual' (/compact)
  preTokens?: number;
  // Marcadores finos reusam o divisor: 'wakeup' (loop agendado acordou) e
  // 'pr' (pull request aberto — label + url clicável). Sem kind = compactação.
  kind?: 'wakeup' | 'pr';
  label?: string;
  url?: string;
  ts?: number;
  // Nº de marcadores consecutivos coalescidos num divisor só (loop noturno gera
  // dezenas de wakeups seguidos — empilhados viravam poluição visual).
  count?: number;
}

export type Message = UserMessage | AssistantMessage | CompactMessage;

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
// Nível de pensamento (--effort do CLI). Default do Deck = 'low' (econômico).
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

// Cron do Deck: dispara um prompt em horário agendado (turno autônomo). Schedule
// minimalista: intervalo (a cada N min) ou diário (minuto do dia, hora local).
export interface CronSchedule { kind: 'interval' | 'daily'; everyMinutes?: number; atMinute?: number }
export interface Cron {
  id: string;
  name: string;
  prompt: string;
  schedule: CronSchedule;
  model?: string;
  mode?: PermMode;
  effort?: Effort;
  enabled: boolean;
  lastRun?: number;
  createdAt: number;
}
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

// Feature "graph" (rota /graph): knowledge graph de um repo via graphify (AST
// tree-sitter, local). GraphMeta = card na lista; GraphData = payload projetado
// pro renderizador canvas (só o que a viz usa, já com teto de nós/arestas).
export interface GraphMeta { id: string; label: string; nodes: number; edges: number; mtime: number; ratio?: number }
export interface GraphNode {
  id: string;
  label: string;
  community: number;
  communityName?: string;
  file?: string;
  loc?: string;
  fileType?: string;
  repo?: string; // presente só no grafo global (merge de apps) — de qual app é o nó
  deg: number; // grau (nº de arestas) — dimensiona o raio e prioriza no corte
}
export interface GraphEdge { source: string; target: string; relation: string; confidence: 'EXTRACTED' | 'INFERRED' }
export interface GraphData {
  directed: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: { id: number; name: string }[];
  truncated: boolean;   // true = a viz mostra um subconjunto (grafo maior que o teto)
  totalNodes: number;
  totalEdges: number;
}

// Pontos: ledger vivo de pontuação (story points). A IA registra ao terminar uma
// task (evento create); o usuário corrige (correct) sem sobrescrever — o histórico
// prevalece (append-only). PointsEvent = uma linha do ledger; PointsEntry = a
// projeção dobrada (valor atual + trilha de procedência).
export interface PointsEvent {
  id: string;
  entryId: string;
  kind: 'create' | 'correct' | 'note' | 'delete';
  title?: string;
  points?: number;
  description?: string;
  by: 'agent' | 'user';
  at: number;
}
export interface PointsHistoryItem {
  kind: 'create' | 'correct' | 'note' | 'delete';
  points?: number;
  description?: string;
  by: 'agent' | 'user';
  at: number;
}
export interface PointsEntry {
  entryId: string;
  title: string;
  points: number;          // valor ATUAL (último create/correct)
  originalPoints: number;  // o do create
  description?: string;
  createdAt: number;
  updatedAt: number;
  by: 'agent' | 'user';    // quem CRIOU a entry
  corrected: boolean;      // points !== originalPoints
  history: PointsHistoryItem[];
  deleted: boolean;        // sempre false no payload visível (deletadas somem do fold)
}

export type ClientMsg =
  // skills = ids das skills SELECIONADAS p/ este prompt (subconjunto de SkillMeta.id).
  // Vazio/ausente = todas ativas (default fail-open). O backend nega via permission
  // rule as NÃO-selecionadas (--disallowedTools Skill(id)); ver buildArgs.
  | { t: 'send'; sessionKey: string; sessionId?: string; text: string; msgId?: string; mode?: PermMode; model?: string; effort?: Effort; maxBudgetUsd?: number; bypass?: boolean; skills?: string[]; mcps?: string[] }
  | { t: 'accounts-list' }
  | { t: 'set-admin'; accountId: string; admin: boolean }
  | { t: 'stop'; sessionKey: string }
  | { t: 'list' }
  // Resume (mobile): reemite o estado durável (busy/rate/plan-usage/models +
  // sessions) que o CLI só manda durante um run, sem depender de eventos perdidos.
  | { t: 'sync' }
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
  | { t: 'notes-get' }
  | { t: 'notes-save'; text: string }
  | { t: 'points-get' }
  | { t: 'points-add'; title: string; points: number; description?: string }
  | { t: 'points-correct'; entryId: string; points: number }
  | { t: 'points-note'; entryId: string; description: string }
  | { t: 'points-delete'; entryId: string }
  | { t: 'ctx-install'; slug: string; title: string; body: string }
  | { t: 'skill-install'; slug: string; title: string; body: string }
  | { t: 'crons-get' }
  | { t: 'cron-save'; cron: Cron }
  | { t: 'cron-delete'; id: string }
  | { t: 'cron-run'; id: string }
  | { t: 'skill-list' }
  | { t: 'skill-open'; id: string }
  | { t: 'usage-list' }
  | { t: 'refresh-models' }
  | { t: 'admin-health' }
  // Admin write-ops no host (#162, DR-023). Gated por role admin (authorize) e —
  // p/ cli-install (RCE) — por loopback (CONFIG.localOnly) no dispatch. Valor de
  // token nunca volta; só o nome aparece em health.envTokens.
  | { t: 'admin-env-set'; name: string; value: string }
  | { t: 'admin-env-unset'; name: string }
  | { t: 'admin-mcp-add'; name: string; command?: string; url?: string }
  | { t: 'admin-mcp-remove'; name: string }
  | { t: 'admin-cli-install'; name: string }
  | { t: 'upload'; sessionKey: string; name: string; dataB64: string; clientId?: string }
  | { t: 'upload-chunk'; uploadId: string; sessionKey: string; name: string; seq: number; total: number; dataB64: string; clientId?: string }
  | { t: 's3-config' }
  | { t: 'attach-ref'; sessionKey: string; name: string; s3url: string; clientId?: string }
  | { t: 'att-open'; path: string }
  | { t: 'term-open'; termId: string; cols: number; rows: number }
  | { t: 'term-input'; termId: string; data: string }
  | { t: 'term-resize'; termId: string; cols: number; rows: number }
  | { t: 'term-detach'; termId: string }
  | { t: 'term-close'; termId: string }
  | { t: 'term-list' }
  | { t: 'graph-list' }
  | { t: 'graph-build'; repo: string }
  | { t: 'graph-open'; id: string }
  | { t: 'graph-query'; id: string; question: string; budget?: number }
  | { t: 'graph-node-op'; id: string; op: 'explain' | 'affected' | 'path'; a: string; b?: string }
  | { t: 'graph-delete'; id: string };

// Capabilities da conexão (DR-011). role = papel do ator (hoje sempre admin em
// loopback; Fase 2 vem do token). canBypass = se o servidor permite o toggle de
// bypass (env opt-in + admin + loopback). A UI só mostra o switch quando true.
// role: engine Role no loopback ('admin'|'student'); AccountRole no T3
// ('root'|'admin'|'fellow'). Privilegiado = 'admin'|'root'.
export type Caps = { role: 'root' | 'admin' | 'fellow' | 'student'; canBypass: boolean };

export type ServerMsg =
  | { t: 'caps'; caps: Caps }
  | { t: 'mcp-servers'; servers: string[] }  // nomes dos MCP disponíveis (do ~/.claude.json), p/ o seletor por sessão; default = nenhum carregado
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
  | { t: 'notes'; text: string }
  | { t: 'points'; entries: PointsEntry[]; total: number }
  | { t: 'crons'; items: Cron[] }
  | { t: 'context'; id: string; title: string; body: string }
  | { t: 'models'; models: ModelInfo[] }
  | { t: 'skills'; items: SkillMeta[] }
  | { t: 'skill'; id: string; name: string; body: string }
  | { t: 'uploaded'; name: string; path: string; text?: string; s3url?: string; clientId?: string }
  | { t: 's3-config'; uploadUrl: string; anonKey: string }
  | { t: 'install-result'; kind: 'context' | 'skill'; ok: boolean; id?: string; error?: string }
  // Conteúdo de um anexo p/ preview no chat (modal). error preenchido quando o
  // arquivo já foi varrido pelo TTL ou o path é inválido — o modal mostra o aviso.
  | { t: 'attachment'; path: string; name: string; dataB64?: string; error?: string }
  | { t: 'history'; sessionId: string; messages: Message[]; cursor?: string; tokens?: number; full?: boolean; truncated?: boolean; todos?: ToolTodo[] }
  | { t: 'busy'; keys: string[] }
  // O JSONL da sessão mudou no disco (ex.: claude rodado direto no terminal).
  // Cliente com a sessão aberta re-puxa o histórico — sem F5.
  | { t: 'session-touched'; sessionId: string }
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
  | { t: 'replay'; sessionKey: string; text: string; thinking: string; tools: ToolCall[]; startedAt?: number; sessionId?: string }
  | { t: 'system'; sessionKey: string; sessionId: string }
  | { t: 'slash-commands'; items: string[] }
  | { t: 'delta'; sessionKey: string; text: string }
  | { t: 'thinking'; sessionKey: string; text: string }
  | { t: 'tool'; sessionKey: string; tool: ToolCall }
  | { t: 'rate'; resetsAt: number; status: string }
  | { t: 'plan-usage'; usage: PlanUsage }
  | { t: 'usage'; sessionKey: string; tokens: number; turnTokens?: number }
  | { t: 'compact'; sessionKey: string; trigger?: string; preTokens?: number; kind?: 'wakeup' | 'pr'; label?: string }
  | { t: 'usage-stats'; stats: UsageStats }
  | { t: 'health'; health: AdminHealth }
  | { t: 'admin-op'; ok: boolean; message: string }
  | { t: 'accounts'; accounts: AccountSummary[] }
  | { t: 'stats'; stats: SysStats }
  | { t: 'graphs'; items: GraphMeta[] }
  | { t: 'graph-data'; id: string; graph: GraphData }
  | { t: 'graph-query-result'; id: string; question: string; answer: string; tokens: number; miss: boolean }
  | { t: 'graph-build-progress'; line: string }
  | { t: 'graph-build-done'; ok: boolean; id?: string; error?: string }
  | { t: 'term-data'; termId: string; data: string }
  | { t: 'term-replay'; termId: string; data: string }
  | { t: 'term-exit'; termId: string }
  | { t: 'terms'; ids: string[] }
  | { t: 'done'; sessionKey: string; sessionId: string; costUsd?: number; durationMs?: number; numTurns?: number; turnTokens?: number; inputTokens?: number; outputTokens?: number; endReason?: string; model?: string; stopped?: boolean }
  // Tópicos de continuação sugeridos pós-turno (chips selecionáveis, estilo ChatGPT).
  | { t: 'suggestions'; sessionKey: string; items: string[] }
  | { t: 'error'; sessionKey?: string; message: string };
