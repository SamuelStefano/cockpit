import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ClaudeEvent } from './events';
import { CONFIG } from '../config';
import type { Role } from '../auth';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Gate do bypassPermissions (#94, DR-011). bypass só é permitido com TODAS as
// quatro condições — qualquer uma falsa cai no fluxo normal (safeMode). Pura e
// testável: recebe cfg explícito em vez de ler CONFIG. Defesa em profundidade —
// flag de servidor (opt-in do dono) + role admin + loopback. Sem identidade real
// ainda (role vem do seam currentRole, hoje constante 'admin'); a flag de env é o
// que torna isto seguro na Fase 1, e o loopback impede bypass exposto sem auth.
export function bypassAllowed(
  gate: { bypass?: boolean; role?: Role } | undefined,
  cfg: { allowBypass: boolean; host: string },
): boolean {
  return !!gate?.bypass && gate.role === 'admin' && cfg.allowBypass === true && cfg.host === '127.0.0.1';
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

  const rl = createInterface({ input: child.stdout! });
  rl.on('line', (line) => {
    const s = line.trim();
    if (!s) return;
    try {
      onEvent(JSON.parse(s) as ClaudeEvent);
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
  let killTimer: NodeJS.Timeout | undefined;
  const finish = () => {
    if (closed) return;
    closed = true;
    if (killTimer) { clearTimeout(killTimer); killTimer = undefined; }
    onClose();
  };
  child.on('error', (err) => { onError(sanitize(err.message)); finish(); });
  child.on('close', (code) => {
    // Qualquer saída não-zero vira erro visível — antes, sem stderr, um crash
    // silencioso parecia "done" com sucesso (madrugada inteira sem saber). Kill
    // por sinal (stop do usuário) vem com code=null, então não dispara aqui.
    if (code && code !== 0) {
      const tail = stderr.trim().slice(-300);
      onError(sanitize(tail ? `claude saiu (${code}): ${tail}` : `claude saiu (${code})`));
    }
    finish();
  });

  return {
    kill: () => {
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

// env curto: PATH + HOME + idioma. Nada de tokens/SUPABASE_*/Infisical.
function minimalEnv(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    TERM: 'dumb',
  };
}

// nunca vazar caminho de segredo/stack cru pro cliente
export function sanitize(msg: string): string {
  return msg.replace(/\/home\/[^\s]+/g, '<path>').slice(0, 300);
}
