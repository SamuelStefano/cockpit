import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { readFileSync, statSync } from 'node:fs';
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

// Read for a read-modify-write. Only a missing file means "start empty": a parse
// error (a concurrent `claude` caught mid-write) must abort, or writing the
// fallback back would wipe every other MCP server / managed token in the file.
export async function readJsonForWrite<T>(path: string, empty: T): Promise<T> {
  let raw: string;
  try { raw = await readFile(path, 'utf8'); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return empty; throw e; }
  return JSON.parse(raw) as T;
}

// tmp + rename so a crash or a concurrent reader never sees a half-written file.
// Keeps the current mode (env.json holds tokens and must stay 0600).
export async function writeJson(path: string, value: unknown, fallbackMode = 0o600): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const mode = await stat(path).then((st) => st.mode & 0o777, () => fallbackMode);
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode });
  await rename(tmp, path);
}

const unreadable = (path: string, e: unknown) =>
  ({ ok: false, message: `não consegui ler ${path} (${(e as Error).message}); nada foi gravado` });

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

// O `.credentials.json` guarda MAIS de um login: os OAuth dos MCP servers ficam em
// `mcpOAuth` e a conta Claude em `claudeAiOauth`. Quem só configurou um MCP tem o
// arquivo sem nunca ter logado — daí não bastar existsSync. Token vencido sem
// refreshToken também não é login: o CLI falha igual a não ter nenhum.
function hasOauthLogin(path: string): boolean {
  try {
    const o = (JSON.parse(readFileSync(path, 'utf8')) as { claudeAiOauth?: Record<string, unknown> }).claudeAiOauth;
    if (typeof o?.accessToken !== 'string' || !o.accessToken) return false;
    return !(typeof o.expiresAt === 'number' && o.expiresAt < Date.now() && typeof o.refreshToken !== 'string');
  } catch { return false; }
}

// Há uma conta Anthropic conectada nesta box? O `claude` aceita login OAuth
// (~/.claude/.credentials.json) OU uma key via env. Cobrimos os dois e o token
// gerenciado (#162). Síncrono: lê o cache do env e o disco — chamado a cada connect
// pra avisar a UI quando nada vai rodar.
//
// Olha o CONTEÚDO, não só a existência: um arquivo de credencial vazio (criado por
// um login interrompido — nesta box o ~/.config/anthropic/credentials tem 0 byte)
// respondia "pronto" e o banner de login nunca aparecia. O usuário mandava o prompt,
// o spawn morria sem explicação, e a única tela que sabia dizer o porquê ficava
// escondida justamente no caso em que ela era necessária.
export function claudeReady(home = homedir()): boolean {
  if (process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim()) return true;
  if (cache.ANTHROPIC_API_KEY?.trim() || cache.ANTHROPIC_AUTH_TOKEN?.trim()) return true;
  return hasOauthLogin(join(home, '.claude', '.credentials.json'))
    || nonEmptyFile(join(home, '.config', 'anthropic', 'credentials'));
}

function nonEmptyFile(path: string): boolean {
  try { return statSync(path).size > 0; } catch { return false; }
}

// Names that change how every spawned process loads code or where it sends the
// OAuth bearer. On the owner's loopback box that is already allowed, but from a
// remote (dial-mode) admin it is RCE / token exfiltration, same class as cli-install.
const REMOTE_DENIED_ENV = /^(LD_|DYLD_|NODE_|BASH_ENV$|ENV$|PATH$|HOME$|SHELL$|ANTHROPIC_BASE_URL$|CLAUDE_|GIT_|PYTHON|PERL|RUBY|.*_PROXY$|COCKPIT_|DECK_|DFL_)/i;

export function envNameAllowedRemotely(name: string): boolean {
  return !REMOTE_DENIED_ENV.test(name);
}

export async function setEnv(name: string, value: string): Promise<{ ok: boolean; message: string }> {
  if (!ENV_NAME_RE.test(name)) return { ok: false, message: 'nome de env inválido' };
  let env: Record<string, string>;
  try { env = await readJsonForWrite<Record<string, string>>(ENV_FILE, {}); } catch (e) { return unreadable(ENV_FILE, e); }
  env[name] = value;
  await writeJson(ENV_FILE, env);
  cache[name] = value;
  process.env[name] = value;
  return { ok: true, message: `${name} salvo` };
}

export async function unsetEnv(name: string): Promise<{ ok: boolean; message: string }> {
  let env: Record<string, string>;
  try { env = await readJsonForWrite<Record<string, string>>(ENV_FILE, {}); } catch (e) { return unreadable(ENV_FILE, e); }
  if (!(name in env)) return { ok: false, message: `${name} não existe` };
  delete env[name];
  await writeJson(ENV_FILE, env);
  delete cache[name];
  delete process.env[name];
  return { ok: true, message: `${name} removido` };
}

// --- MCP servers (edita ~/.claude.json, o que o `claude` lê) -----------------

interface ClaudeJson { mcpServers?: Record<string, unknown>; [k: string]: unknown }

// hostname do URL parser mantém os colchetes no IPv6 (ex.: '[::1]').
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

// Valida a URL de um MCP http ANTES de gravar (SSRF/exfil): o `claude` depois abre
// conexão pra o host que o cliente mandar. https obrigatório (http só em loopback),
// e userinfo (user:pass@) proibido — não plantar credencial no ~/.claude.json.
export function validateMcpUrl(raw: string): { ok: boolean; message: string } {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, message: 'url do MCP inválida' }; }
  if (u.username || u.password) return { ok: false, message: 'url do MCP não pode conter credenciais' };
  const loopback = LOOPBACK_HOSTS.has(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && loopback)) {
    return { ok: false, message: 'url do MCP precisa ser https (http só em loopback)' };
  }
  return { ok: true, message: 'ok' };
}

export async function addMcp(name: string, opts: { command?: string; url?: string }): Promise<{ ok: boolean; message: string }> {
  if (!name.trim()) return { ok: false, message: 'nome do MCP vazio' };
  let j: ClaudeJson;
  try { j = await readJsonForWrite<ClaudeJson>(CLAUDE_JSON, {}); } catch (e) { return unreadable(CLAUDE_JSON, e); }
  const servers = (j.mcpServers ??= {});
  if (opts.url) {
    const v = validateMcpUrl(opts.url);
    if (!v.ok) return v;
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
  let j: ClaudeJson;
  try { j = await readJsonForWrite<ClaudeJson>(CLAUDE_JSON, {}); } catch (e) { return unreadable(CLAUDE_JSON, e); }
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
