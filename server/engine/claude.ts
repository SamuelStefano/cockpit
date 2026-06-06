import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ClaudeEvent } from './events';
import { CONFIG } from '../config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface RunOpts {
  prompt: string;
  resumeId?: string;
  mode?: string;               // pedido pela UI; passa por safeMode (nunca bypass)
  model?: string;              // alias opus/sonnet/haiku (validado por allow-list)
  effort?: string;             // low|medium|high|xhigh|max (validado)
  maxBudgetUsd?: number;       // teto de gasto por run (--max-budget-usd)
  onEvent: (ev: ClaudeEvent) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

const MODELS = new Set(['opus', 'sonnet', 'haiku']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

export interface RunHandle {
  kill: () => void;
}

// Spawn do claude headless com hardening DR-004:
// - argv array, shell:false (sem command injection)
// - --permission-mode plan (NÃO bypass) na Fase 1
// - env mínimo (não vaza segredo do processo pai)
// - cwd isolado
// - detached pra matar a árvore no stop
export function run(opts: RunOpts): RunHandle {
  const { prompt, resumeId, mode, model, effort, maxBudgetUsd, onEvent, onError, onClose } = opts;

  // UI pede o modo por mensagem; resolveMode garante que bypass nunca passa.
  const { permissionMode, allow } = resolveMode(mode);

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--permission-mode', permissionMode,
  ];
  // Allow-list de valores (nunca repassa string arbitrária da UI pro argv).
  if (model && MODELS.has(model)) args.push('--model', model);
  if (effort && EFFORTS.has(effort)) args.push('--effort', effort);
  if (typeof maxBudgetUsd === 'number' && Number.isFinite(maxBudgetUsd) && maxBudgetUsd > 0) {
    args.push('--max-budget-usd', String(maxBudgetUsd));
  }
  // Allow-list explícita pra o agente trabalhar sem prompt interativo (headless
  // não tem como responder). NÃO é bypass (bypass libera tudo; aqui é uma lista
  // nomeada e auditável, no espírito do DR-004). Plan-mode nunca recebe lista.
  if (allow.length) {
    args.push('--allowedTools', allow.join(' '));
  }
  if (resumeId) {
    if (!UUID_RE.test(resumeId)) {
      onError('sessionId inválido');
      onClose();
      return { kill: () => {} };
    }
    args.push('--resume', resumeId);
  }

  const child: ChildProcess = spawn('claude', args, {
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

  let stderr = '';
  child.stderr!.on('data', (d) => { stderr += String(d).slice(0, 2000); });

  // Spawn falho (ex: `claude` fora do PATH) emite 'error' mas pode NÃO emitir
  // 'close' — sem isto o thread nunca limpa e o cliente trava no spinner.
  let closed = false;
  const finish = () => { if (closed) return; closed = true; onClose(); };
  child.on('error', (err) => { onError(sanitize(err.message)); finish(); });
  child.on('close', (code) => {
    if (code && code !== 0 && stderr) onError(sanitize(`claude saiu (${code})`));
    finish();
  });

  return {
    kill: () => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGTERM');
      } catch {
        child.kill('SIGTERM');
      }
    },
  };
}

// Mapeia o modo da UI → permission-mode do CLI + allow-list. 'bypassPermissions'
// (RCE root via sudo NOPASSWD) NUNCA é um caso: qualquer valor desconhecido cai
// no default do backend (plan na Fase 1). auto = edita sem shell; acceptEdits =
// edita E roda. plan = nada executa, sem allow-list.
function resolveMode(mode: string | undefined): { permissionMode: string; allow: string[] } {
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
