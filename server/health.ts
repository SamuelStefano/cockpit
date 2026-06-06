import { readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AdminHealth, CliInfo, McpInfo } from '../shared/protocol';
import { CONFIG } from './config';
import { collect } from './stats';

const run = promisify(execFile);

async function exists(p: string): Promise<boolean> {
  return stat(p).then(() => true).catch(() => false);
}

async function countDir(dir: string, filter: (name: string) => boolean): Promise<number> {
  const names = await readdir(dir).catch(() => [] as string[]);
  return names.filter(filter).length;
}

export function mcpInfoFrom(raw: string): McpInfo[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as { mcpServers?: Record<string, { type?: string; command?: string; url?: string }> };
    const servers = j.mcpServers ?? {};
    return Object.entries(servers).map(([name, cfg]) => ({
      name,
      transport: cfg?.type ?? (cfg?.command ? 'stdio' : cfg?.url ? 'http' : 'unknown'),
    }));
  } catch { return []; }
}

export function parseSshHosts(configText: string): string[] {
  const out: string[] = [];
  for (const line of configText.split('\n')) {
    const m = /^\s*Host\s+(.+)$/i.exec(line);
    if (!m) continue;
    for (const alias of m[1].trim().split(/\s+/)) {
      if (alias && !alias.includes('*') && !alias.includes('?') && !out.includes(alias)) out.push(alias);
    }
  }
  return out;
}

const TOKEN_RE = /(TOKEN|SECRET|PASSWORD|API[_-]?KEY|CREDENTIAL|_KEY$|^KEY_)/i;
export function tokenEnvNames(env: Record<string, string | undefined>): string[] {
  return Object.keys(env).filter((k) => TOKEN_RE.test(k)).sort();
}

export function parseTmuxList(stdout: string): string[] {
  return stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}

const CLI_LIST = ['git', 'gh', 'docker', 'claude', 'node', 'npm', 'tmux', 'ssh', 'psql', 'vercel', 'supabase', 'infisical', 'rg', 'jq', 'curl'];
export function parseWhich(stdout: string, list: string[]): CliInfo[] {
  const found = new Set(stdout.split('\n').map((p) => p.trim().split('/').pop()).filter(Boolean));
  return list.map((name) => ({ name, present: found.has(name) }));
}

async function clis(): Promise<CliInfo[]> {
  const out = await run('which', CLI_LIST).then((r) => r.stdout).catch((e: { stdout?: string }) => e?.stdout ?? '');
  return parseWhich(out, CLI_LIST);
}

async function tmuxSessions(): Promise<string[]> {
  const out = await run('tmux', ['ls', '-F', '#{session_name}']).then((r) => r.stdout).catch(() => '');
  return parseTmuxList(out);
}

async function sshKeys(): Promise<number> {
  const dir = join(homedir(), '.ssh');
  return countDir(dir, (n) => n.startsWith('id_') && !n.endsWith('.pub'));
}

export async function collectHealth(): Promise<AdminHealth> {
  const [claudeAuth, mcpRaw, sshConfig, ssh, cli, tmux, sessions, memories, skills, sys] = await Promise.all([
    exists(join(homedir(), '.claude', '.credentials.json')),
    readFile(join(homedir(), '.claude.json'), 'utf8').catch(() => ''),
    readFile(join(homedir(), '.ssh', 'config'), 'utf8').catch(() => ''),
    sshKeys(),
    clis(),
    tmuxSessions(),
    countDir(CONFIG.projectsDir, (n) => n.endsWith('.jsonl')),
    countDir(CONFIG.memoryDir, (n) => n.endsWith('.md')),
    countDir(CONFIG.skillsDir, () => true),
    collect(),
  ]);
  const mcp = mcpInfoFrom(mcpRaw);
  return {
    claudeAuth,
    mcpServers: mcp.map((m) => m.name),
    mcp,
    sshKeys: ssh,
    sshHosts: parseSshHosts(sshConfig),
    clis: cli,
    envTokens: tokenEnvNames(process.env),
    tmuxSessions: tmux,
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
