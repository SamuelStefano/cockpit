import { homedir } from 'node:os';
import { join } from 'node:path';

// Config do backend. Segredos (quando houver) vêm do Infisical, nunca de .env
// versionado. Na Fase 1 não há segredo (Pro usa auth local do CLI).
export const CONFIG = {
  host: '127.0.0.1', // DR-001/DR-004: zero porta pública até hardening
  port: Number(process.env.COCKPIT_PORT ?? 7777),

  // Diretório dos JSONL do CLI (fonte da verdade das sessões).
  projectsDir: join(homedir(), '.claude', 'projects', '-home-samuel'),

  // cwd isolado pro spawn do claude (DR-004 #4).
  workdir: process.env.COCKPIT_WORKDIR ?? join(homedir(), 'cockpit-workdir'),

  // DR-004 #1: plan-mode na Fase 1 (NÃO bypassPermissions).
  permissionMode: process.env.COCKPIT_PERMISSION_MODE ?? 'plan',

  // Paginação de history (squad M3: maior JSONL = 46MB).
  historyLimit: 60,
};
