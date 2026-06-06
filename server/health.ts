import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AdminHealth } from '../shared/protocol';
import { CONFIG } from './config';
import { collect } from './stats';

// Painel admin READ-ONLY (DR-007): health da máquina/agente. NUNCA lê conteúdo de
// credencial — só checa EXISTÊNCIA por stat. Tudo best-effort: falha vira
// false/0, nunca derruba a resposta. Sem controle/escrita (auth-gate fica p/ depois).

async function exists(p: string): Promise<boolean> {
  return stat(p).then(() => true).catch(() => false);
}

async function countDir(dir: string, filter: (name: string) => boolean): Promise<number> {
  const names = await readdir(dir).catch(() => [] as string[]);
  return names.filter(filter).length;
}

// Conta servidores MCP configurados sem expor segredo: só as CHAVES do objeto.
async function mcpServers(): Promise<string[]> {
  const raw = await readFile(join(homedir(), '.claude.json'), 'utf8').catch(() => '');
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    return j.mcpServers ? Object.keys(j.mcpServers) : [];
  } catch { return []; }
}

async function sshKeys(): Promise<number> {
  const dir = join(homedir(), '.ssh');
  return countDir(dir, (n) => n.startsWith('id_') && !n.endsWith('.pub'));
}

export async function collectHealth(): Promise<AdminHealth> {
  const [claudeAuth, mcp, ssh, sessions, memories, skills, sys] = await Promise.all([
    exists(join(homedir(), '.claude', '.credentials.json')),
    mcpServers(),
    sshKeys(),
    countDir(CONFIG.projectsDir, (n) => n.endsWith('.jsonl')),
    countDir(CONFIG.memoryDir, (n) => n.endsWith('.md')),
    countDir(CONFIG.skillsDir, () => true),
    collect(),
  ]);
  return {
    claudeAuth,
    mcpServers: mcp,
    sshKeys: ssh,
    sessions,
    memories,
    skills,
    node: process.version,
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    host: CONFIG.host,
    port: CONFIG.port,
    permissionMode: CONFIG.permissionMode,
    disk: sys.disk,
  };
}
