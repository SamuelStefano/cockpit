import { createPrivateKey, sign as edSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface GithubToken { account_login: string; token: string; expires_at: string }
interface BoxIdentity { agentId: string; privateKeyPem: string }

const DEFAULT_SUPABASE_URL = 'https://ikxtdssxmcgipyfpwmar.supabase.co';
const TIMEOUT_MS = 30_000;
const REFRESH_MARGIN_MS = 5 * 60_000;

export const agentStateDir = (env: NodeJS.ProcessEnv = process.env): string => env.DECK_AGENT_DIR || join(homedir(), '.deck-agent');

// Read directly instead of importing agent-main: this runs in the credential-helper
// process and in minimalEnv, neither of which may load the whole agent graph.
export function readIdentity(env: NodeJS.ProcessEnv = process.env): BoxIdentity | null {
  try {
    const id = JSON.parse(readFileSync(join(agentStateDir(env), 'identity.json'), 'utf8')) as Partial<BoxIdentity>;
    return id.agentId && id.privateKeyPem ? { agentId: id.agentId, privateKeyPem: id.privateKeyPem } : null;
  } catch { return null; }
}

export const tokenUrl = (env: NodeJS.ProcessEnv = process.env): string =>
  `${(env.DECK_SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '')}/functions/v1/github-app/token`;

export function signTokenRequest(privateKeyPem: string, agentId: string, ts: number): string {
  return edSign(null, Buffer.from(`deck-gh-token.${ts}.${agentId}`), createPrivateKey(privateKeyPem)).toString('base64');
}

let cache: GithubToken[] = [];
let cacheUntil = 0;

export function resetGithubTokenCache(): void { cache = []; cacheUntil = 0; }

export function cacheDeadline(tokens: GithubToken[]): number {
  const times = tokens.map((t) => Date.parse(t.expires_at)).filter((n) => Number.isFinite(n));
  return times.length ? Math.min(...times) - REFRESH_MARGIN_MS : 0;
}

// Best-effort: an unpaired box, a network error or an unlinked account all yield [],
// so the box keeps using its own gh login / PAT exactly as before.
export async function fetchGithubTokens(now: () => number = Date.now, fetchImpl: typeof fetch = fetch): Promise<GithubToken[]> {
  if (cache.length && now() < cacheUntil) return cache;
  const id = readIdentity();
  if (!id) return [];
  try {
    const ts = now();
    const res = await fetchImpl(tokenUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent_id: id.agentId, ts, sig: signTokenRequest(id.privateKeyPem, id.agentId, ts) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { tokens?: GithubToken[] };
    const tokens = (body.tokens ?? []).filter((t) => t?.token && t.account_login);
    cache = tokens;
    cacheUntil = cacheDeadline(tokens);
    return tokens;
  } catch { return []; }
}

export function parseCredentialInput(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of input.split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

export function pickToken(fields: Record<string, string>, tokens: GithubToken[]): GithubToken | null {
  if (fields.protocol !== 'https' || fields.host?.toLowerCase() !== 'github.com' || !tokens.length) return null;
  const owner = (fields.path ?? '').split('/')[0].toLowerCase();
  const hit = owner ? tokens.find((t) => t.account_login.toLowerCase() === owner) : undefined;
  return hit ?? (tokens.length === 1 ? tokens[0] : null);
}

export function credentialOutput(fields: Record<string, string>, tokens: GithubToken[]): string {
  const t = pickToken(fields, tokens);
  return t ? `username=x-access-token\npassword=${t.token}\n` : '';
}

export function helperCommand(env: NodeJS.ProcessEnv = process.env): string {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const dir = env.DECK_AGENT_DIR ? `DECK_AGENT_DIR=${q(env.DECK_AGENT_DIR)} ` : '';
  const sup = env.DECK_SUPABASE_URL ? `DECK_SUPABASE_URL=${q(env.DECK_SUPABASE_URL)} ` : '';
  return `!cd ${q(root)} && ${dir}${sup}exec ${q(process.execPath)} ${q(join(root, 'node_modules/tsx/dist/cli.mjs'))} server/agent.ts --git-credential`;
}

// Appends after any GIT_CONFIG_COUNT already in the env instead of replacing it.
export function mergeGitConfigEnv(base: NodeJS.ProcessEnv, entries: [string, string][]): NodeJS.ProcessEnv {
  const n = Number.parseInt(base.GIT_CONFIG_COUNT ?? '', 10);
  const start = Number.isInteger(n) && n >= 0 ? n : 0;
  const out: NodeJS.ProcessEnv = { ...base, GIT_CONFIG_COUNT: String(start + entries.length) };
  entries.forEach(([k, v], i) => { out[`GIT_CONFIG_KEY_${start + i}`] = k; out[`GIT_CONFIG_VALUE_${start + i}`] = v; });
  return out;
}

export function withGithubCredentialHelper(base: NodeJS.ProcessEnv, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  if (!readIdentity(env)) return base;
  return mergeGitConfigEnv(base, [
    ['credential.https://github.com.helper', helperCommand(env)],
    ['credential.https://github.com.useHttpPath', 'true'],
  ]);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

// `git credential` protocol, `get` only: store/erase and every non-match print
// nothing and exit 0 so git falls through to its other helpers.
export async function gitCredentialCli(action: string | undefined): Promise<void> {
  if (action === 'get') {
    const fields = parseCredentialInput(await readStdin());
    if (fields.host?.toLowerCase() === 'github.com') process.stdout.write(credentialOutput(fields, await fetchGithubTokens()));
  }
  process.exit(0);
}
