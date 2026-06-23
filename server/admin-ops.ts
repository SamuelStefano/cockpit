import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

// Operações de admin que ESCREVEM no host (DR-023 #162): tokens de ambiente, MCPs e
// instalação de CLI. Gated no relay/agent por role admin (authorize default-deny) e
// — pro caminho RCE (cli-install) — por loopback (CONFIG.localOnly) no dispatch.
// VALORES de token nunca voltam pro cliente; só nomes (via health.envTokens).

const ENV_FILE = join(homedir(), '.deck-agent', 'env.json');
const CLAUDE_JSON = join(homedir(), '.claude.json');

// Nome de env válido: LETRA/_ seguido de alfanum/_. Barra injeção e chaves estranhas.
const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path, 'utf8')) as T; } catch { return fallback; }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

// --- env/tokens gerenciados -------------------------------------------------
// Persistidos em ~/.deck-agent/env.json e injetados no spawn do claude
// (minimalEnv os mescla) — sem isso o agente não enxergaria o token.

// Cache síncrono p/ o spawn do claude (minimalEnv é sync). loadManagedEnv() é
// chamado no boot do backend; setEnv/unsetEnv mantêm o cache em dia.
let cache: Record<string, string> = {};

export async function managedEnv(): Promise<Record<string, string>> {
  return readJson<Record<string, string>>(ENV_FILE, {});
}

export function managedEnvSync(): Record<string, string> {
  return cache;
}

// Definições COMPLETAS dos MCP servers do ~/.claude.json (command/url/headers/env).
// Síncrono pro spawn do claude (run() escreve um --mcp-config filtrado). Vazio se o
// arquivo não existe/parseia. Os valores podem ter token — quem chama grava 0600.
export function mcpServerDefsSync(): Record<string, unknown> {
  try {
    const j = JSON.parse(readFileSync(CLAUDE_JSON, 'utf8')) as { mcpServers?: Record<string, unknown> };
    return j.mcpServers ?? {};
  } catch { return {}; }
}

export async function loadManagedEnv(): Promise<void> {
  cache = await managedEnv();
}

// Há uma conta Anthropic conectada nesta box? O `claude` aceita login OAuth
// (~/.claude/.credentials.json) OU uma key via env. Cobrimos os dois e o token
// gerenciado (#162). Síncrono: lê o cache do env e existsSync — chamado a cada
// connect pra avisar a UI quando nada vai rodar.
export function claudeReady(): boolean {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return true;
  if (cache.ANTHROPIC_API_KEY || cache.ANTHROPIC_AUTH_TOKEN) return true;
  const home = homedir();
  return existsSync(join(home, '.claude', '.credentials.json'))
    || existsSync(join(home, '.config', 'anthropic', 'credentials'));
}

export async function setEnv(name: string, value: string): Promise<{ ok: boolean; message: string }> {
  if (!ENV_NAME_RE.test(name)) return { ok: false, message: 'nome de env inválido' };
  const env = await managedEnv();
  env[name] = value;
  await writeJson(ENV_FILE, env);
  cache[name] = value;
  process.env[name] = value;
  return { ok: true, message: `${name} salvo` };
}

export async function unsetEnv(name: string): Promise<{ ok: boolean; message: string }> {
  const env = await managedEnv();
  if (!(name in env)) return { ok: false, message: `${name} não existe` };
  delete env[name];
  await writeJson(ENV_FILE, env);
  delete cache[name];
  delete process.env[name];
  return { ok: true, message: `${name} removido` };
}

// --- MCP servers (edita ~/.claude.json, o que o `claude` lê) -----------------

interface ClaudeJson { mcpServers?: Record<string, unknown>; [k: string]: unknown }

export async function addMcp(name: string, opts: { command?: string; url?: string }): Promise<{ ok: boolean; message: string }> {
  if (!name.trim()) return { ok: false, message: 'nome do MCP vazio' };
  const j = await readJson<ClaudeJson>(CLAUDE_JSON, {});
  const servers = (j.mcpServers ??= {});
  if (opts.url) {
    servers[name] = { type: 'http', url: opts.url };
  } else if (opts.command) {
    const [cmd, ...args] = opts.command.split(/\s+/);
    servers[name] = { type: 'stdio', command: cmd, args };
  } else {
    return { ok: false, message: 'informe url ou command' };
  }
  await writeJson(CLAUDE_JSON, j);
  return { ok: true, message: `MCP ${name} adicionado` };
}

export async function removeMcp(name: string): Promise<{ ok: boolean; message: string }> {
  const j = await readJson<ClaudeJson>(CLAUDE_JSON, {});
  if (!j.mcpServers || !(name in j.mcpServers)) return { ok: false, message: `MCP ${name} não existe` };
  delete j.mcpServers[name];
  await writeJson(CLAUDE_JSON, j);
  return { ok: true, message: `MCP ${name} removido` };
}

// --- instalação de CLI (RCE → só loopback, gated no dispatch) ----------------
// Allow-list fechada: só pacotes npm-global nomeados. execFile com args em array
// (sem shell) impede injeção. Nada de comando arbitrário do cliente.

const INSTALLERS: Record<string, { cmd: string; args: string[] }> = {
  vercel: { cmd: 'npm', args: ['i', '-g', 'vercel'] },
  supabase: { cmd: 'npm', args: ['i', '-g', 'supabase'] },
  infisical: { cmd: 'npm', args: ['i', '-g', '@infisical/cli'] },
  pnpm: { cmd: 'npm', args: ['i', '-g', 'pnpm'] },
  yarn: { cmd: 'npm', args: ['i', '-g', 'yarn'] },
  typescript: { cmd: 'npm', args: ['i', '-g', 'typescript'] },
  vitest: { cmd: 'npm', args: ['i', '-g', 'vitest'] },
};

export const INSTALLABLE = Object.keys(INSTALLERS);

export async function installCli(name: string): Promise<{ ok: boolean; message: string }> {
  const spec = INSTALLERS[name];
  if (!spec) return { ok: false, message: `${name} não está na allow-list` };
  try {
    await run(spec.cmd, spec.args, { timeout: 180_000 });
    return { ok: true, message: `${name} instalado` };
  } catch (e) {
    return { ok: false, message: `falha ao instalar ${name}: ${(e as Error).message.slice(0, 120)}` };
  }
}
