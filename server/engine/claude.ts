import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ClaudeEvent } from './events';
import { CONFIG } from '../config';
import { managedEnvSync, mcpServerDefsSync } from '../admin-ops';
import type { Role } from '../auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Gate do bypassPermissions (#94, DR-011). bypass só é permitido com TODAS as
// quatro condições — qualquer uma falsa cai no fluxo normal (safeMode). Pura e
// testável: recebe cfg explícito em vez de ler CONFIG. Defesa em profundidade —
// flag de servidor (opt-in do dono) + role admin + deploy local-confiável. O role
// agora chega de verdade por-conexão (seam da Fase 2, ver runs.ts); a flag de env
// é o opt-in do dono, e localOnly (DR-017 fato 2 — substitui host==='127.0.0.1')
// impede bypass num agente exposto sem auth real.
export function bypassAllowed(
  gate: { bypass?: boolean; role?: Role } | undefined,
  cfg: { allowBypass: boolean; localOnly: boolean },
): boolean {
  return !!gate?.bypass && gate.role === 'admin' && cfg.allowBypass === true && cfg.localOnly === true;
}

export interface RunOpts {
  prompt: string;
  resumeId?: string;
  mode?: string;               // pedido pela UI; passa por safeMode (nunca bypass)
  model?: string;              // alias opus/sonnet/haiku OU id concreto claude-* (validado)
  maxBudgetUsd?: number;       // teto de gasto por run (--max-budget-usd)
  bypass?: boolean;            // pedido explícito de bypass; só vale se bypassAllowed
  role?: Role;                 // role do ator (seam Fase 2); gate do bypass
  disallowedSkills?: string[]; // regras Skill(...) das skills NÃO-selecionadas (ver skillDenyRules)
  mcps?: string[];             // MCP servers a CARREGAR neste turno. Default = NENHUM (strict-mcp-config). Cada server adiciona ~5-20k tokens de tool defs por chamada; carregar só os escolhidos corta o overhead que inflava a quota (vs terminal).
  effort?: string;             // nível de pensamento (--effort low|medium|high|xhigh|max). Sem isto o CLI usa o default da conta (alto) → thinking tokens caros em pedido simples. Default do Deck = low.
  onEvent: (ev: ClaudeEvent) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const MODELS = new Set(['opus', 'sonnet', 'haiku']);
// id concreto vindo de /v1/models (ex: claude-opus-4-8). Ancorado e restrito a
// [a-z0-9-] pra não virar vetor de injeção de flag no argv.
const MODEL_ID_RE = /^claude-[a-z0-9-]+$/;
function validModel(m: string): boolean { return MODELS.has(m) || MODEL_ID_RE.test(m); }

export interface RunHandle {
  kill: () => void;
}

// Spawn do claude headless com hardening DR-004:
// - argv array, shell:false (sem command injection)
// - --permission-mode plan (NÃO bypass) na Fase 1
// - env mínimo (não vaza segredo do processo pai)
// - cwd isolado
// - detached pra matar a árvore no stop
export type BuildArgsOpts = Pick<RunOpts, 'prompt' | 'resumeId' | 'mode' | 'model' | 'effort' | 'maxBudgetUsd' | 'bypass' | 'role' | 'disallowedSkills'>;

export function buildArgs(opts: BuildArgsOpts, mcpConfigPath?: string): { args: string[] } | { error: string } {
  const { prompt, resumeId, mode, model, effort, maxBudgetUsd, bypass, role, disallowedSkills } = opts;
  const { permissionMode, allow } = resolveMode(mode, { bypass, role });

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--permission-mode', permissionMode,
    // Default ZERO MCP: --strict-mcp-config ignora os MCPs do ~/.claude.json (8
    // servers = ~37k tokens de tool defs POR chamada). Só os escolhidos pela
    // sessão entram, via um --mcp-config filtrado (escrito em run()). Chat sem MCP
    // selecionado não paga esse overhead — era a maior diferença pro terminal.
    '--strict-mcp-config',
  ];
  if (mcpConfigPath) args.push('--mcp-config', mcpConfigPath);
  if (model && validModel(model)) args.push('--model', model);
  // Nível de pensamento. Sem a flag o CLI usa o default da conta (alto) e queima
  // thinking tokens até em pedido simples — passar explícito (default low na UI) corta.
  if (effort && EFFORTS.has(effort)) args.push('--effort', effort);
  if (CONFIG.fallbackModel && validModel(CONFIG.fallbackModel) && CONFIG.fallbackModel !== model) {
    args.push('--fallback-model', CONFIG.fallbackModel);
  }
  if (typeof maxBudgetUsd === 'number' && Number.isFinite(maxBudgetUsd) && maxBudgetUsd > 0) {
    args.push('--max-budget-usd', String(maxBudgetUsd));
  }
  if (allow.length) args.push('--allowedTools', allow.join(' '));
  // Kill-switch de tools (config) + skills não-selecionadas (por-prompt) entram no
  // MESMO --disallowedTools (uma flag só; rules space-separated).
  const deny = [...CONFIG.disallowedTools, ...(disallowedSkills ?? [])];
  if (deny.length) args.push('--disallowedTools', deny.join(' '));
  if (resumeId) {
    if (!UUID_RE.test(resumeId)) return { error: 'sessionId inválido' };
    args.push('--resume', resumeId);
  }
  return { args };
}

export function run(opts: RunOpts): RunHandle {
  const { prompt, resumeId, mode, model, effort, maxBudgetUsd, bypass, role, disallowedSkills, onEvent, onError, onClose } = opts;

  // MCP por sessão: escreve um config TEMPORÁRIO só com os servers escolhidos
  // (definições completas lidas do ~/.claude.json). Sem seleção → sem arquivo →
  // --strict-mcp-config sozinho = zero MCP. mode 600 (pode ter token nos headers).
  let mcpConfigPath: string | undefined;
  if (opts.mcps && opts.mcps.length) {
    const all = mcpServerDefsSync();
    const picked: Record<string, unknown> = {};
    for (const name of opts.mcps) if (all[name]) picked[name] = all[name];
    if (Object.keys(picked).length) {
      mcpConfigPath = join(tmpdir(), `deck-mcp-${randomBytes(6).toString('hex')}.json`);
      try { writeFileSync(mcpConfigPath, JSON.stringify({ mcpServers: picked }), { mode: 0o600 }); }
      catch { mcpConfigPath = undefined; }
    }
  }
  const cleanupMcp = () => { if (mcpConfigPath) { try { unlinkSync(mcpConfigPath); } catch { /* já removido */ } mcpConfigPath = undefined; } };

  const built = buildArgs({ prompt, resumeId, mode, model, effort, maxBudgetUsd, bypass, role, disallowedSkills }, mcpConfigPath);
  if ('error' in built) {
    cleanupMcp();
    onError(built.error);
    onClose();
    return { kill: () => {} };
  }

  const child: ChildProcess = spawn('claude', built.args, {
    cwd: CONFIG.workdir,
    env: minimalEnv(),
    shell: false,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // O `claude` emite um evento `result` ao terminar de forma graciosa — inclusive
  // nos cortes esperados (budget/max-turns), que ele reporta como subtype no
  // result E DEPOIS sai com code≠0. Sem registrar que o result já veio, o close
  // handler trataria esse exit como crash e pintaria "claude saiu (1)" por cima
  // do banner correto de "teto atingido / Continuar". Visto o result, o exit não
  // é mais um crash a reportar.
  let sawResult = false;
  const rl = createInterface({ input: child.stdout! });
  rl.on('line', (line) => {
    const s = line.trim();
    if (!s) return;
    try {
      const ev = JSON.parse(s) as ClaudeEvent;
      if (ev.type === 'result') sawResult = true;
      onEvent(ev);
    } catch {
      // linha não-JSON (ruído) — ignora
    }
  });

  // O `slice(0,2000)` era por-chunk, não cumulativo: um run pendurado cuspindo
  // stderr a noite toda crescia o buffer sem teto. Mantém só a cauda (8KB) — é o
  // que o erro de close usa (slice(-300)); o resto não serve pra nada.
  const STDERR_CAP = 8192;
  let stderr = '';
  child.stderr!.on('data', (d) => {
    stderr += String(d);
    if (stderr.length > STDERR_CAP) stderr = stderr.slice(-STDERR_CAP);
  });

  // Spawn falho (ex: `claude` fora do PATH) emite 'error' mas pode NÃO emitir
  // 'close' — sem isto o thread nunca limpa e o cliente trava no spinner.
  let closed = false;
  let killed = false;
  let killTimer: NodeJS.Timeout | undefined;
  const finish = () => {
    if (closed) return;
    closed = true;
    if (killTimer) { clearTimeout(killTimer); killTimer = undefined; }
    cleanupMcp();
    onClose();
  };
  child.on('error', (err) => { onError(sanitize(err.message)); finish(); });
  child.on('close', (code) => {
    if (shouldReportExit(killed, code, sawResult)) {
      const tail = stderr.trim().slice(-300);
      onError(sanitize(tail ? `claude saiu (${code}): ${tail}` : `claude saiu (${code})`));
    }
    finish();
  });

  return {
    kill: () => {
      killed = true;
      const signal = (sig: NodeJS.Signals) => {
        try { if (child.pid) process.kill(-child.pid, sig); }
        catch { try { child.kill(sig); } catch { /* já morto */ } }
      };
      // Varre a ÁRVORE de descendentes AGORA, antes do SIGTERM — não só na escalada.
      // Um tool que chamou setsid (Bash longo, subagente claude -p, MCP stdio) está
      // em grupo próprio e escapa do process.kill(-pid). Se esperássemos os 4s, o
      // SIGTERM abaixo já teria matado o claude e o tool seria REPARENTADO pro init
      // (ppid=1) — o killTree por-ppid não o acharia mais e ele viraria órfão eterno
      // queimando token/CPU. É o "stop não para na hora" que voltava após todo fix:
      // o claude some mas o subagente/Bash segue vivo. Reapar com o claude ainda vivo
      // (ppid intacto) é a única janela em que a árvore é alcançável.
      if (child.pid) killTree(child.pid);
      signal('SIGTERM');
      // Escalada final pro PRÓPRIO claude: se ele ignorar o SIGTERM, SIGKILL no grupo
      // + nova varredura da árvore (pega tool spawnado entre o reap acima e agora).
      // O timer morre no 'close' (finish), evitando matar PID reciclado.
      if (!killTimer) killTimer = setTimeout(() => { signal('SIGKILL'); if (child.pid) killTree(child.pid); }, 4000);
    },
  };
}

// Mata recursivamente a árvore de descendentes de um pid (por ppid via pgrep).
// Best-effort/síncrono: caminho raro (escalada de stop); falhas são ignoradas.
function killTree(pid: number): void {
  let kids: number[] = [];
  try {
    kids = execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8', timeout: 2000 })
      .split('\n').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
  } catch { /* sem filhos ou pgrep ausente */ }
  for (const k of kids) {
    killTree(k);
    try { process.kill(k, 'SIGKILL'); } catch { /* já morto */ }
  }
}

// Mapeia o modo da UI → permission-mode do CLI + allow-list. 'bypassPermissions'
// (RCE root via sudo NOPASSWD) SÓ é alcançável via o gate explícito bypassAllowed
// (#94, DR-011): pedido explícito + role admin + flag de servidor + loopback.
// Sem gate (chamada de 1 arg) o comportamento é idêntico ao da Fase 1 — qualquer
// valor de mode desconhecido cai no default. auto = edita sem shell; acceptEdits
// = edita E roda. plan = nada executa, sem allow-list.
export function resolveMode(
  mode: string | undefined,
  gate?: { bypass?: boolean; role?: Role },
): { permissionMode: string; allow: string[] } {
  if (bypassAllowed(gate, CONFIG)) {
    return { permissionMode: 'bypassPermissions', allow: CONFIG.allowedTools };
  }
  switch (mode) {
    case 'auto':
      return { permissionMode: 'default', allow: CONFIG.allowedToolsAuto };
    case 'acceptEdits':
      return { permissionMode: 'acceptEdits', allow: CONFIG.allowedTools };
    case 'plan':
      return { permissionMode: 'plan', allow: [] };
    default:
      return {
        permissionMode: CONFIG.permissionMode,
        allow: CONFIG.permissionMode === 'acceptEdits' ? CONFIG.allowedTools : [],
      };
  }
}

// env curto: PATH + HOME + idioma + tokens GERENCIADOS pelo admin (#162). Nada de
// SUPABASE_*/Infisical herdados do processo — só o que o dono colocou de propósito
// via painel admin (~/.deck-agent/env.json) entra, pro agente usar nas tools.
function minimalEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    TERM: 'dumb',
    ...managedEnvSync(),
  };
}

// Varre temp-configs de MCP órfãos (deck-mcp-*.json) que sobraram de um crash do
// servidor ENTRE o write e o cleanup do run. Eles têm 0600 e podem conter token nos
// headers — não devem acumular no /tmp. Chamado no boot + no sweep periódico; no
// boot não há run vivo, e no periódico os vivos já foram lidos pelo claude no spawn
// (o --mcp-config é lido uma vez), então apagar é seguro.
export function sweepMcpConfigs(): void {
  try {
    const dir = tmpdir();
    for (const f of readdirSync(dir)) {
      if (/^deck-mcp-[0-9a-f]+\.json$/.test(f)) { try { unlinkSync(join(dir, f)); } catch { /* em uso/sumiu */ } }
    }
  } catch { /* tmp ilegível */ }
}

// nunca vazar caminho de segredo/stack cru pro cliente
export function sanitize(msg: string): string {
  return msg.replace(/\/home\/[^\s]+/g, '<path>').slice(0, 300);
}

// Saída não-zero do `claude` vira erro visível — antes, sem stderr, um crash
// silencioso parecia "done" com sucesso (madrugada inteira sem saber). Mas há dois
// encerramentos não-zero que NÃO são crash:
//  1. stop do usuário: o `claude` instala handler de SIGTERM e sai com code=143
//     (128+15) — não code=null como um kill cru. O guard `killed` cobre
//     143/137/qualquer code do nosso próprio kill.
//  2. corte gracioso (budget/max-turns): o `claude` emite o evento `result` com o
//     subtype E DEPOIS sai com code=1. O guard `sawResult` impede que esse exit
//     vire "claude saiu (1)" por cima do banner "teto atingido / Continuar".
// Só reporta quando NÃO matamos e o `claude` NÃO reportou um result próprio.
export function shouldReportExit(killed: boolean, code: number | null, sawResult = false): boolean {
  return !killed && !sawResult && code != null && code !== 0;
}
