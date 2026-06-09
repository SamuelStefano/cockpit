import { homedir } from 'node:os';
import { join } from 'node:path';

// O CLI nomeia o dir do projeto trocando os separadores do caminho absoluto do
// cwd por '-' (/home/samuel -> -home-samuel; /home/joao -> -home-joao). Derivar o
// slug do workdir em vez de cravar o do Samuel torna o backend portável pra a VPS
// de qualquer fellow (Fase 0b, DR-017): cada um roda na própria box, com o próprio
// HOME. Também casa projectsDir com o cwd do spawn — antes, setar COCKPIT_WORKDIR
// quebrava o --resume (slug fixo != cwd).
export function projectSlug(p: string): string {
  return p.replace(/[/\\:.]/g, '-');
}

const WORKDIR = process.env.COCKPIT_WORKDIR ?? homedir();
const PROJECTS_ROOT = join(homedir(), '.claude', 'projects');

// Config do backend. Segredos (quando houver) vêm do Infisical, nunca de .env
// versionado. Na Fase 1 não há segredo (Pro usa auth local do CLI).
export const CONFIG = {
  host: '127.0.0.1', // DR-001/DR-004: zero porta pública até hardening
  port: Number(process.env.COCKPIT_PORT ?? 7777),

  // Diretório dos JSONL do CLI (fonte da verdade das sessões).
  projectsDir: join(PROJECTS_ROOT, projectSlug(WORKDIR)),

  // Memórias do agente (markdown tipado) — surfaceadas READ-ONLY na aba Contextos.
  memoryDir: join(PROJECTS_ROOT, projectSlug(WORKDIR), 'memory'),

  // Skills do agente (cada dir tem um SKILL.md) — surfaceadas READ-ONLY na rota Skills.
  skillsDir: join(homedir(), '.claude', 'skills'),

  // cwd do spawn do claude. DEVE casar com o slug de projectsDir pra o --resume
  // achar o JSONL: o CLI deriva o dir do projeto do cwd (/home/samuel ->
  // -home-samuel), e listamos/lemos de -home-samuel. Apontar pro workdir isolado
  // (DR-004 #4) quebrava TODO resume ("No conversation found"): superseded por
  // DR-006. cwd nunca foi sandbox real (caminho absoluto fura); contenção real =
  // allow-list do modo (auto sem Bash) + loopback + user não-sudo da Fase 0.
  workdir: WORKDIR,

  // SQLite local (loopback, sem segredo): time-series de uso/tokens p/ o
  // observatório. Mesmo dir do store.json. Override por env.
  dbPath: process.env.COCKPIT_DB ?? join(homedir(), '.cockpit', 'cockpit.db'),

  // Gate de auth do WS (DR-011 Fase 2). Token compartilhado exigido no handshake
  // quando setado; vazio = sem gate (loopback-only, comportamento atual). Setar
  // COCKPIT_TOKEN é o que torna seguro EXPOR o app fora do loopback
  // (Tailscale/Vercel): sem o token a conexão é fechada com código 4401 e a UI
  // pede o token. Single-account — o token É a identidade hoje.
  authToken: process.env.COCKPIT_TOKEN ?? '',

  // DR-004 #1: plan-mode na Fase 1 (NÃO bypassPermissions). Allow-list trava
  // qualquer env solto de armar bypass (= RCE root) por engano.
  permissionMode: safeMode(process.env.COCKPIT_PERMISSION_MODE),

  // Modelo de fallback quando o primário está sobrecarregado (overload). Resiliência
  // pra runs longos/noturnos: o CLI cai pra cá em vez de abortar. Validado contra a
  // allow-list de modelos no engine. Vazio = sem fallback.
  fallbackModel: process.env.COCKPIT_FALLBACK_MODEL ?? '',

  // Quantas mensagens (user/assistant) do fim da sessão o history devolve. 60 era
  // baixíssimo: sessões de daily-driver têm milhares de records, então no reload
  // o usuário via só um pedacinho do fim ("só algumas mensagens aparecem"). O
  // history parseado NÃO carrega output de tool (só comando/diff), então o payload
  // por mensagem é pequeno e 500 cabe folgado no loopback. Full-history/paginação
  // (carregar anteriores) fica como evolução. Override por env.
  historyLimit: Number(process.env.COCKPIT_HISTORY_LIMIT ?? 500),

  // Teto do prompt: evita ARG_MAX/DoS no spawn (argv -p).
  maxPromptBytes: 100_000,

  // Teto de runs `claude -p` vivos ao mesmo tempo: no loop autônomo a noite toda
  // um cliente bugado podia abrir sessões sem fim e fritar CPU/token. Substituir
  // uma key existente sempre passa; só barra abertura de NOVAS sessões além disto.
  maxConcurrentRuns: Number(process.env.COCKPIT_MAX_RUNS ?? 12),

  // Teto por anexo gravado no workdir (loopback-only, mas evita encher o disco).
  maxUploadBytes: 15_000_000,

  // Anexos são one-shot (o agente lê no turno e nunca mais). Varre e apaga os
  // mais velhos que isto pra o workdir não crescer sem limite num daily driver.
  attachmentTtlMs: Number(process.env.COCKPIT_ATTACHMENT_TTL_MS ?? 7 * 24 * 60 * 60 * 1000),

  // Resumo IA da sessão (1 frase do que ela fez), gerado ao fim de cada turno via
  // API Anthropic (haiku, barato). Default ligado; COCKPIT_SUMMARY=off desliga.
  // Modelo dedicado (não o do chat) pra manter o custo do resumo previsível.
  summaryEnabled: process.env.COCKPIT_SUMMARY !== 'off',
  summaryModel: process.env.COCKPIT_SUMMARY_MODEL ?? 'claude-haiku-4-5-20251001',

  // Gate DURO do bypassPermissions (#94, DR-011). Default FALSE: numa máquina com
  // sudo NOPASSWD + grupo docker + containers DFL prod na mesma box, bypass = RCE
  // root. Mesmo ligado, só vale com role admin E loopback (ver bypassAllowed no
  // engine). É opt-in do dono no servidor; sem isto o toggle da UI é inerte.
  allowBypass: process.env.COCKPIT_ALLOW_BYPASS === '1',

  // Deploy é local-confiável (DR-017 fato 2): substitui o literal host==='127.0.0.1'
  // que estava cravado no gate de bypass/caps. O acoplamento ao loopback estava
  // errado pro mundo federado (T3): no agente da VPS de um fellow o host não é
  // loopback, então bypass E o cap caíam pra false — o DONO da própria box nunca
  // veria o toggle. Aqui a intenção ("este deploy é a box de quem manda") fica
  // explícita e separada do bind. Default = loopback (idêntico ao de hoje);
  // COCKPIT_LOCAL_ONLY=0/1 sobrescreve quando o agente roda fora do loopback.
  localOnly: process.env.COCKPIT_LOCAL_ONLY !== undefined
    ? process.env.COCKPIT_LOCAL_ONLY === '1'
    : true, // host é sempre 127.0.0.1 hoje

  // Tools pré-aprovadas no modo Executar (acceptEdits). Allow-list nomeada,
  // não bypass. Override por env COCKPIT_ALLOWED_TOOLS (separado por vírgula).
  // WebFetch/WebSearch entram pré-aprovados: como o `claude -p` roda com stdin
  // ignorado (sem control protocol), tool fora da allow-list é negada sem ter
  // como pedir aprovação — então read-only de rede precisa estar listada pra
  // funcionar. Bloqueio via COCKPIT_DISALLOWED_TOOLS continua valendo (precede).
  allowedTools: (process.env.COCKPIT_ALLOWED_TOOLS ?? 'Bash,Read,Edit,Write,Glob,Grep,WebFetch,WebSearch')
    .split(',').map((s) => s.trim()).filter(Boolean),

  // Modo Auto: edita/lê sem shell. Mesma allow-list SEM Bash — o agente trabalha
  // arquivos sozinho mas não roda comandos arbitrários. WebFetch/WebSearch
  // (read-only de rede) entram pra não travar pesquisa/leitura de página.
  allowedToolsAuto: (process.env.COCKPIT_ALLOWED_TOOLS_AUTO ?? 'Read,Edit,Write,Glob,Grep,WebFetch,WebSearch')
    .split(',').map((s) => s.trim()).filter(Boolean),

  // Kill-switch DURO: tools aqui são negadas em TODOS os modos (precede a allow-list
  // no CLI). Vazio por padrão. Ex: COCKPIT_DISALLOWED_TOOLS=WebFetch,WebSearch pra
  // travar saída de rede mesmo no modo Executar.
  disallowedTools: (process.env.COCKPIT_DISALLOWED_TOOLS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean),
};

// 'bypassPermissions' nunca entra: numa máquina com sudo NOPASSWD = RCE root.
export function safeMode(v: string | undefined): 'plan' | 'default' | 'acceptEdits' {
  return v === 'default' || v === 'acceptEdits' ? v : 'plan';
}
