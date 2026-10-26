import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  DFL_MANIFEST_URL, FALLBACK_HOSTS, addArgv, mergeStates, parseManifest, parseMcpList, validHost,
  type DflMcpEndpoint, type DflMcpsState,
} from '../shared/dfl-mcps';
import { cliPath } from './engine/cli-path';

const run = promisify(execFile);

const MANIFEST_TTL_MS = 10 * 60_000;
const FETCH_TIMEOUT_MS = 5_000;
const LIST_TIMEOUT_MS = 60_000;
const ADD_TIMEOUT_MS = 20_000;

type Runner = (args: string[], timeoutMs: number) => Promise<string>;

// Writes only the box user's ~/.claude.json through the CLI (scope user): no
// token or file path crosses the wire. Adding is admin-only (server/ws/authz.ts).
const claude: Runner = async (args, timeout) => {
  const { stdout } = await run('claude', args, { timeout, env: { ...process.env, PATH: cliPath(), TERM: 'dumb' }, maxBuffer: 1024 * 1024 });
  return stdout;
};

let cache: { at: number; hosts: DflMcpEndpoint[] } | null = null;

export function resetManifestCache(): void { cache = null; }

export async function loadHosts(
  fetchFn: typeof fetch = fetch, now = Date.now(),
): Promise<{ hosts: readonly DflMcpEndpoint[]; source: DflMcpsState['source'] }> {
  if (cache && now - cache.at < MANIFEST_TTL_MS) return { hosts: cache.hosts, source: 'manifest' };
  try {
    const res = await fetchFn(DFL_MANIFEST_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const hosts = parseManifest(await res.json());
    if (!hosts) throw new Error('manifest without published hosts');
    cache = { at: now, hosts };
    return { hosts, source: 'manifest' };
  } catch {
    return { hosts: cache?.hosts ?? FALLBACK_HOSTS, source: cache ? 'manifest' : 'fallback' };
  }
}

export async function dflMcpsState(deps: { exec?: Runner; fetchFn?: typeof fetch } = {}): Promise<DflMcpsState> {
  const exec = deps.exec ?? claude;
  const { hosts, source } = await loadHosts(deps.fetchFn);
  try {
    const listed = parseMcpList(await exec(['mcp', 'list'], LIST_TIMEOUT_MS));
    return { hosts: mergeStates(hosts, listed), source };
  } catch (e) {
    return { hosts: mergeStates(hosts, []).map((h) => ({ ...h, status: 'failed' as const })), source, error: `não consegui rodar "claude mcp list": ${(e as Error).message.split('\n')[0]}` };
  }
}

// `requested` empty = every host still missing. Names are matched against the
// manifest, never passed through: an unknown or malformed host is ignored.
export async function addDflMcps(requested: unknown, deps: { exec?: Runner; fetchFn?: typeof fetch } = {}): Promise<DflMcpsState> {
  const exec = deps.exec ?? claude;
  const { hosts } = await loadHosts(deps.fetchFn);
  const before = await dflMcpsState(deps);
  const all = !Array.isArray(requested) || requested.length === 0;
  const asked = Array.isArray(requested) ? requested.filter(validHost) : [];
  const todo = before.hosts.filter((h) => h.status === 'missing' && (all || asked.includes(h.host)) && hosts.some((m) => m.host === h.host));
  const failures: string[] = [];
  for (const h of todo) {
    try { await exec(addArgv(h), ADD_TIMEOUT_MS); } catch (e) { failures.push(`${h.host}: ${(e as Error).message.split('\n')[0]}`); }
  }
  const after = await dflMcpsState(deps);
  const added = todo.length - failures.length;
  const op = failures.length
    ? { ok: false, message: `falhou: ${failures.join('; ')}` }
    : { ok: true, message: todo.length ? `${added} MCP(s) adicionado(s)` : 'nada a adicionar' };
  return { ...after, op };
}
