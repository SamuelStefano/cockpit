import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { ClaudeEvent } from './events';
import { CONFIG } from '../config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface RunOpts {
  prompt: string;
  resumeId?: string;
  onEvent: (ev: ClaudeEvent) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

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
  const { prompt, resumeId, onEvent, onError, onClose } = opts;

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--permission-mode', CONFIG.permissionMode,
  ];
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

  child.on('error', (err) => onError(sanitize(err.message)));
  child.on('close', (code) => {
    if (code && code !== 0 && stderr) onError(sanitize(`claude saiu (${code})`));
    onClose();
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
function sanitize(msg: string): string {
  return msg.replace(/\/home\/[^\s]+/g, '<path>').slice(0, 300);
}
