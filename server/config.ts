import { homedir } from 'node:os';
import { join } from 'node:path';

// Config do backend. Segredos (quando houver) vêm do Infisical, nunca de .env
// versionado. Na Fase 1 não há segredo (Pro usa auth local do CLI).
export const CONFIG = {
  host: '127.0.0.1', // DR-001/DR-004: zero porta pública até hardening
  port: Number(process.env.COCKPIT_PORT ?? 7777),

  // Diretório dos JSONL do CLI (fonte da verdade das sessões).
  projectsDir: join(homedir(), '.claude', 'projects', '-home-samuel'),

  // Memórias do agente (markdown tipado) — surfaceadas READ-ONLY na aba Contextos.
  memoryDir: join(homedir(), '.claude', 'projects', '-home-samuel', 'memory'),

  // cwd isolado pro spawn do claude (DR-004 #4).
  workdir: process.env.COCKPIT_WORKDIR ?? join(homedir(), 'cockpit-workdir'),

  // DR-004 #1: plan-mode na Fase 1 (NÃO bypassPermissions). Allow-list trava
  // qualquer env solto de armar bypass (= RCE root) por engano.
  permissionMode: safeMode(process.env.COCKPIT_PERMISSION_MODE),

  // Paginação de history (squad M3: maior JSONL = 46MB).
  historyLimit: 60,

  // Teto do prompt: evita ARG_MAX/DoS no spawn (argv -p).
  maxPromptBytes: 100_000,

  // Tools pré-aprovadas no modo Executar (acceptEdits). Allow-list nomeada,
  // não bypass. Override por env COCKPIT_ALLOWED_TOOLS (separado por vírgula).
  allowedTools: (process.env.COCKPIT_ALLOWED_TOOLS ?? 'Bash,Read,Edit,Write,Glob,Grep')
    .split(',').map((s) => s.trim()).filter(Boolean),

  // Modo Auto: edita/lê sem shell. Mesma allow-list SEM Bash — o agente trabalha
  // arquivos sozinho mas não roda comandos arbitrários.
  allowedToolsAuto: (process.env.COCKPIT_ALLOWED_TOOLS_AUTO ?? 'Read,Edit,Write,Glob,Grep')
    .split(',').map((s) => s.trim()).filter(Boolean),
};

// 'bypassPermissions' nunca entra: numa máquina com sudo NOPASSWD = RCE root.
export function safeMode(v: string | undefined): 'plan' | 'default' | 'acceptEdits' {
  return v === 'default' || v === 'acceptEdits' ? v : 'plan';
}
