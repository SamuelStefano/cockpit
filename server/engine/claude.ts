import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ClaudeEvent } from './events';
import { CONFIG } from '../config';
import { managedEnvSync } from '../admin-ops';
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
  onEvent: (ev: ClaudeEvent) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

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
export type BuildArgsOpts = Pick<RunOpts, 'prompt' | 'resumeId' | 'mode' | 'model' | 'maxBudgetUsd' | 'bypass' | 'role'>;

export function buildArgs(opts: BuildArgsOpts): { args: string[] } | { error: string } {
  const { prompt, resumeId, mode, model, maxBudgetUsd, bypass, role } = opts;
  const { permissionMode, allow } = resolveMode(mode, { bypass, role });

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--permission-mode', permissionMode,
  ];
  if (model && validModel(model)) args.push('--model', model);
  if (CONFIG.fallbackModel && validModel(CONFIG.fallbackModel) && CONFIG.fallbackModel !== model) {
    args.push('--fallback-model', CONFIG.fallbackModel);
  }
  if (typeof maxBudgetUsd === 'number' && Number.isFinite(maxBudgetUsd) && maxBudgetUsd > 0) {
    args.push('--max-budget-usd', String(maxBudgetUsd));
  }
  if (allow.length) args.push('--allowedTools', allow.join(' '));
  if (CONFIG.disallowedTools.length) args.push('--disallowedTools', CONFIG.disallowedTools.join(' '));
  if (resumeId) {
    if (!UUID_RE.test(resumeId)) return { error: 'sessionId inválido' };
    args.push('--resume', resumeId);
  }
  return { args };
}

export function run(opts: RunOpts): RunHandle {
  const { prompt, resumeId, mode, model, maxBudgetUsd, bypass, role, onEvent, onError, onClose } = opts;

  const built = buildArgs({ prompt, resumeId, mode, model, maxBudgetUsd, bypass, role });
  if ('error' in built) {
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
      signal('SIGTERM');
      // Escalada: se o processo (ou um tool filho que ignora SIGTERM) não fechar
      // em 5s, SIGKILL no grupo — senão vira zumbi segurando a sessão a noite
      // toda. O timer morre no 'close' (finish), evitando matar PID reciclado.
      if (!killTimer) killTimer = setTimeout(() => signal('SIGKILL'), 5000);
    },
  };
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
