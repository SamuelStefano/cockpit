import { Resolver } from 'node:dns/promises';
import { request } from 'node:https';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { readdir, readFile, readlink } from 'node:fs/promises';
import { APPS, RELAY_FALLBACK, RELAY_HOSTNAME, RELAY_IP, SPA_URL, WEB_HOSTNAME, type TriageConfig } from './config.ts';
import { run, ssh, withTimeout, type Runner } from './exec.ts';
import { parseSections, probeScript } from './relay.ts';
import { cleanText } from './sanitize.ts';

export type CheckId =
  | 'dns_cf' | 'dns_google' | 'dns_web' | 'ws_upgrade' | 'public_status' | 'fallback_status' | 'ssh' | 'relay_local' | 'relay_active'
  | 'caddy_active' | 'dokploy_web' | 'dokploy_ops' | 'spa_bundle' | 'agents' | 'local_agent_service' | 'local_agent_owner'
  | 'login_path' | 'auth_flow';
export type CheckStatus = 'ok' | 'fail' | 'warn' | 'skip';
export interface Check { id: CheckId; status: CheckStatus; detail: string; metrics?: Record<string, number> }
export interface Findings { at: string; checks: Check[]; relayLog: string[] }

export const CHECK_LABELS: Record<CheckId, string> = {
  dns_cf: 'DNS (1.1.1.1)',
  dns_google: 'DNS (8.8.8.8)',
  dns_web: `DNS de ${WEB_HOSTNAME}`,
  ws_upgrade: 'WebSocket /ws no relay público',
  public_status: 'relay público /status',
  fallback_status: 'relay fallback sslip /status',
  ssh: 'ssh no host do relay',
  relay_local: 'relay local :8800/status',
  relay_active: 'serviço deck-relay',
  caddy_active: 'serviço caddy',
  dokploy_web: 'Dokploy deck-web',
  dokploy_ops: 'Dokploy deck-ops',
  spa_bundle: 'bundle do SPA aponta pro relay',
  agents: 'boxes da conta',
  local_agent_service: 'deck-agent (systemd, esta VPS)',
  local_agent_owner: 'agente do dono (~/cockpit)',
  login_path: 'login no relay (JWT forjado deve dar 4401 rápido)',
  auth_flow: 'logins reais no relay (últimos 10 min)',
};

// Checks run from this VPS, outside any user's network. One failing (twice) = real outage.
export const SYNTHETIC_IDS: ReadonlySet<CheckId> = new Set<CheckId>([
  'dns_cf', 'dns_google', 'dns_web', 'public_status', 'fallback_status', 'ws_upgrade', 'spa_bundle', 'ssh', 'relay_local', 'relay_active', 'caddy_active', 'login_path', 'auth_flow',
]);

export const failingSynthetic = (f: Findings): Check[] => f.checks.filter((c) => SYNTHETIC_IDS.has(c.id) && c.status === 'fail');

export interface CheckDeps {
  cfg: Pick<TriageConfig, 'relay' | 'dokploy' | 'localRepo'>;
  runner?: Runner;
  fetchImpl?: typeof fetch;
  resolve4?: (server: string, host: string) => Promise<string[]>;
  wsUpgrade?: (url: string) => Promise<number>;
  loginProbe?: (url: string, origin: string) => Promise<number>;
}

const T = 8_000;

async function defaultResolve4(server: string, host: string): Promise<string[]> {
  const r = new Resolver({ timeout: 3000, tries: 2 });
  r.setServers([server]);
  return r.resolve4(host);
}

async function dnsCheck(id: CheckId, server: string, resolve4: NonNullable<CheckDeps['resolve4']>): Promise<Check> {
  try {
    const ips = await withTimeout(resolve4(server, RELAY_HOSTNAME), T, 'dns');
    if (ips.includes(RELAY_IP)) return { id, status: 'ok', detail: `A ${ips.join(', ')}` };
    return { id, status: 'fail', detail: `aponta para ${ips.join(', ') || 'nada'}, esperado ${RELAY_IP}` };
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'ENOTFOUND' || code === 'ENODATA') return { id, status: 'fail', detail: `sem registro A (${code})` };
    return { id, status: 'warn', detail: `consulta falhou: ${cleanText((e as Error).message, 80)}` };
  }
}

async function webDnsCheck(resolve4: NonNullable<CheckDeps['resolve4']>): Promise<Check> {
  const id: CheckId = 'dns_web';
  const out = await Promise.all(['1.1.1.1', '8.8.8.8'].map((srv) => withTimeout(resolve4(srv, WEB_HOSTNAME), T, 'dns').then((ips) => ips, (e) => (e as { code?: string }).code ?? 'erro')));
  const missing = out.filter((r) => r === 'ENOTFOUND' || r === 'ENODATA');
  if (missing.length) return { id, status: 'fail', detail: 'sem registro A' };
  const ips = out.find(Array.isArray);
  return ips ? { id, status: 'ok', detail: `A ${ips.join(', ')}` } : { id, status: 'warn', detail: 'consulta falhou' };
}

// Resolves with the HTTP status of the handshake: 101 when the relay accepts the upgrade.
function defaultWsUpgrade(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': randomBytes(16).toString('base64') },
      timeout: T,
    });
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode ?? 101); });
    req.on('response', (res) => { res.resume(); resolve(res.statusCode ?? 0); });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function wsCheck(wsUpgrade: NonNullable<CheckDeps['wsUpgrade']>): Promise<Check> {
  const id: CheckId = 'ws_upgrade';
  try {
    const code = await withTimeout(wsUpgrade(`https://${RELAY_HOSTNAME}/ws`), T + 2000, 'ws');
    return { id, status: code === 101 ? 'ok' : 'fail', detail: `HTTP ${code}` };
  } catch (e) {
    const cause = (e as { code?: string }).code;
    return { id, status: 'fail', detail: cleanText(cause ?? (e as Error).message, 100) };
  }
}

const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Unsigned garbage on purpose: it is no secret and can only ever be refused (4401).
export const PROBE_TOKEN = `${b64u({ alg: 'ES256', typ: 'JWT', kid: 'probe-unknown' })}.${b64u({ sub: 'probe' })}.AAAA`;
export const LOGIN_OK_MS = 5_000;
export const LOGIN_HARD_MS = 12_000;

// Resolves with the close code the relay answers a forged login with.
function defaultLoginProbe(url: string, origin: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { origin, handshakeTimeout: LOGIN_HARD_MS });
    const timer = setTimeout(() => { ws.terminate(); reject(new Error(`sem fechamento em ${LOGIN_HARD_MS / 1000}s`)); }, LOGIN_HARD_MS);
    ws.on('close', (code) => { clearTimeout(timer); resolve(code); });
    ws.on('error', (e) => { clearTimeout(timer); reject(e); });
    ws.on('unexpected-response', (_req, res) => { clearTimeout(timer); res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); });
  });
}

export async function loginCheck(loginProbe: NonNullable<CheckDeps['loginProbe']>, now: () => number = Date.now): Promise<Check> {
  const id: CheckId = 'login_path';
  const t0 = now();
  try {
    const code = await withTimeout(loginProbe(`wss://${RELAY_HOSTNAME}/ws?token=${PROBE_TOKEN}`, `https://${WEB_HOSTNAME}`), LOGIN_HARD_MS, 'login');
    const ms = now() - t0;
    if (code === 4401 && ms <= LOGIN_OK_MS) return { id, status: 'ok', detail: `4401 em ${ms} ms`, metrics: { login_ms: ms } };
    if (code === 4401) return { id, status: 'fail', detail: `4401 mas lento: ${ms} ms (limite ${LOGIN_OK_MS} ms)`, metrics: { login_ms: ms } };
    return { id, status: 'fail', detail: `fechou com ${code} em ${ms} ms, esperado 4401`, metrics: { login_ms: ms } };
  } catch (e) {
    return { id, status: 'fail', detail: cleanText((e as { code?: string }).code ?? (e as Error).message, 100) };
  }
}

async function httpStatus(id: CheckId, url: string, f: typeof fetch): Promise<Check> {
  try {
    const res = await f(url, { signal: AbortSignal.timeout(T), redirect: 'manual' });
    return { id, status: res.ok ? 'ok' : 'fail', detail: `HTTP ${res.status}` };
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause?.code;
    return { id, status: 'fail', detail: cleanText(cause ?? (e as Error).message, 100) };
  }
}

async function dokployCheck(id: CheckId, appId: string, deps: CheckDeps): Promise<Check> {
  const d = deps.cfg.dokploy;
  if (!d) return { id, status: 'skip', detail: 'sem credenciais do Dokploy' };
  const f = deps.fetchImpl ?? fetch;
  try {
    const input = encodeURIComponent(JSON.stringify({ json: { applicationId: appId } }));
    const res = await f(`${d.url}/api/trpc/application.one?input=${input}`, { headers: { [d.header]: d.token }, signal: AbortSignal.timeout(T) });
    if (!res.ok) return { id, status: 'warn', detail: `Dokploy HTTP ${res.status}` };
    const j = ((await res.json()) as { result?: { data?: { json?: { applicationStatus?: string; deployments?: { status?: string; createdAt?: string }[] } } } }).result?.data?.json;
    const deps2 = [...(j?.deployments ?? [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const last = deps2[0];
    const app = String(j?.applicationStatus ?? '?');
    const lastSt = String(last?.status ?? '?');
    const bad = app === 'error' || lastSt === 'error';
    const busy = app === 'running' || lastSt === 'running';
    return { id, status: bad ? 'fail' : busy ? 'warn' : 'ok', detail: `app ${cleanText(app, 20)}, último deploy ${cleanText(lastSt, 20)} ${cleanText(last?.createdAt ?? '', 30)}` };
  } catch (e) {
    return { id, status: 'warn', detail: cleanText((e as Error).message, 100) };
  }
}

async function bundleCheck(f: typeof fetch, resolve4: NonNullable<CheckDeps['resolve4']>): Promise<Check> {
  const id: CheckId = 'spa_bundle';
  try {
    const html = await (await f(`${SPA_URL}/`, { signal: AbortSignal.timeout(T) })).text();
    const src = /<script[^>]+type="module"[^>]+src="(\/assets\/[A-Za-z0-9._-]+\.js)"/.exec(html)?.[1];
    if (!src) return { id, status: 'fail', detail: 'index.html sem script de entrada' };
    const js = await (await f(`${SPA_URL}${src}`, { signal: AbortSignal.timeout(15_000) })).text();
    const hosts = [RELAY_HOSTNAME, RELAY_FALLBACK].filter((h) => js.includes(`wss://${h}`));
    if (!hosts.length) return { id, status: 'fail', detail: `${src} não contém wss://${RELAY_HOSTNAME}` };
    const resolved = await Promise.all(hosts.map((h) => withTimeout(resolve4('1.1.1.1', h), T, 'dns').then(() => true, () => false)));
    const live = hosts.filter((_, i) => resolved[i]);
    if (!live.length) return { id, status: 'fail', detail: `${src} usa ${hosts.join(' + ')}, que não resolve` };
    return { id, status: 'ok', detail: `${src} usa ${hosts.join(' + ')} (resolve: ${live.join(', ')})` };
  } catch (e) {
    return { id, status: 'warn', detail: cleanText((e as Error).message, 100) };
  }
}

interface AgentRow { id?: string; label?: string; kind?: string; last_seen?: string | null; revoked_at?: string | null }

export function summarizeAgents(raw: string | undefined): Check {
  const id: CheckId = 'agents';
  if (raw === undefined) return { id, status: 'skip', detail: 'sem conta no incidente' };
  let rows: AgentRow[];
  try { rows = JSON.parse(raw) as AgentRow[]; } catch { return { id, status: 'warn', detail: 'resposta ilegível' }; }
  if (!Array.isArray(rows) || !rows.length) return { id, status: 'warn', detail: 'nenhuma box pareada' };
  const live = rows.filter((r) => !r.revoked_at);
  const parts = live.slice(0, 4).map((r) => `${cleanText(r.label || r.id?.slice(0, 8), 30)} visto ${cleanText((r.last_seen ?? 'nunca').slice(0, 16).replace('T', ' '), 20)}`);
  return { id, status: live.length ? 'ok' : 'warn', detail: `${live.length} ativa(s): ${parts.join('; ')}` };
}

export const AUTH_FLOW_MIN_STALLS = 3;

export function authFlowCheck(raw: string | undefined): Check {
  const id: CheckId = 'auth_flow';
  const m = /^ok=(\d{1,7}) c4408=(\d{1,7}) stall=(\d{1,7})$/.exec((raw ?? '').trim());
  if (!m) return { id, status: 'warn', detail: 'contagem ilegível' };
  const [ok, c4408, stall] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const metrics = { auth_ok: ok, close_4408: c4408, stall };
  const detail = `10 min: ${ok} login(s) ok, ${c4408} fechamento(s) 4408, ${stall} travada(s)`;
  return { id, status: c4408 >= AUTH_FLOW_MIN_STALLS && ok === 0 ? 'fail' : 'ok', detail, metrics };
}

async function relayProbe(deps: CheckDeps, accountId: string | null): Promise<{ checks: Check[]; log: string[] }> {
  const res = await ssh(deps.runner ?? run, deps.cfg.relay, probeScript(accountId), 25_000);
  if (res.code === null || res.code === 255 || !res.stdout.includes('@@end')) {
    const why = res.timedOut ? 'timeout' : cleanText(res.stderr, 100) || `exit ${res.code}`;
    const ids: CheckId[] = ['relay_local', 'relay_active', 'caddy_active', 'auth_flow'];
    return { checks: [{ id: 'ssh', status: 'fail', detail: why }, ...ids.map((id) => ({ id, status: 'skip' as const, detail: 'sem ssh' }))], log: [] };
  }
  const s = parseSections(res.stdout);
  const code = (s.status ?? '').trim();
  const active = (v: string | undefined, id: CheckId): Check => ({ id, status: v?.trim() === 'active' ? 'ok' : 'fail', detail: cleanText(v || '?', 30) });
  const checks: Check[] = [
    { id: 'ssh', status: 'ok', detail: 'conectado' },
    { id: 'relay_local', status: code === '200' ? 'ok' : 'fail', detail: `HTTP ${cleanText(code, 5) || '000'}` },
    active(s.relay, 'relay_active'),
    active(s.caddy, 'caddy_active'),
    authFlowCheck(s.auth),
  ];
  if (accountId) checks.push(summarizeAgents(s.agents ?? '[]'));
  const log = (s.log ?? '').split('\n').filter(Boolean).slice(-50).map((l) => cleanText(l, 240));
  return { checks, log };
}

async function localAgentChecks(deps: CheckDeps): Promise<Check[]> {
  const runner = deps.runner ?? run;
  const svc = await runner('systemctl', ['is-active', 'deck-agent'], { timeoutMs: 5000 });
  const pids = await findOwnerAgentPids(deps.cfg.localRepo);
  return [
    { id: 'local_agent_service', status: svc.stdout.trim() === 'active' ? 'ok' : 'fail', detail: cleanText(svc.stdout || svc.stderr, 30) },
    { id: 'local_agent_owner', status: pids.length ? 'ok' : 'fail', detail: pids.length ? `pid ${pids.join(',')}` : 'processo não encontrado' },
  ];
}

// Same anchor as scripts/redeploy.sh: an exact `server/agent.ts` argv entry AND cwd at
// the live checkout. Worktrees run the same relative argv; only the cwd tells them apart.
export async function findOwnerAgentPids(repo: string): Promise<number[]> {
  const out: number[] = [];
  let entries: string[] = [];
  try { entries = await readdir('/proc'); } catch { return out; }
  for (const e of entries) {
    if (!/^\d+$/.test(e)) continue;
    try {
      const argv = (await readFile(`/proc/${e}/cmdline`, 'utf8')).split('\0');
      if (!argv.includes('server/agent.ts')) continue;
      if ((await readlink(`/proc/${e}/cwd`)) !== repo) continue;
      out.push(Number(e));
    } catch { /* process gone or not ours */ }
  }
  return out;
}

export type CheckScope = 'synthetic' | 'full';

export async function runChecks(deps: CheckDeps, accountId: string | null, scope: CheckScope = 'full', now = () => new Date()): Promise<Findings> {
  const f = deps.fetchImpl ?? fetch;
  const resolve4 = deps.resolve4 ?? defaultResolve4;
  const full = scope === 'full';
  const guard = <T>(p: Promise<T>, fallback: T) => withTimeout(p, 40_000, 'check').catch(() => fallback);
  const skipped = (id: CheckId): Promise<Check> => Promise.resolve({ id, status: 'skip', detail: 'fora do escopo' });
  const [dnsCf, dnsGg, dnsWeb, pub, fb, ws, login, probe, web, ops, bundle, local] = await Promise.all([
    dnsCheck('dns_cf', '1.1.1.1', resolve4),
    dnsCheck('dns_google', '8.8.8.8', resolve4),
    webDnsCheck(resolve4),
    httpStatus('public_status', `https://${RELAY_HOSTNAME}/status`, f),
    httpStatus('fallback_status', `https://${RELAY_FALLBACK}/status`, f),
    wsCheck(deps.wsUpgrade ?? defaultWsUpgrade),
    loginCheck(deps.loginProbe ?? defaultLoginProbe),
    guard(relayProbe(deps, full ? accountId : null), { checks: [{ id: 'ssh' as const, status: 'fail' as const, detail: 'timeout' }], log: [] }),
    full ? dokployCheck('dokploy_web', APPS.web, deps) : skipped('dokploy_web'),
    full ? dokployCheck('dokploy_ops', APPS.ops, deps) : skipped('dokploy_ops'),
    bundleCheck(f, resolve4),
    full ? guard(localAgentChecks(deps), []) : Promise.resolve([]),
  ]);
  return { at: now().toISOString(), checks: [dnsCf, dnsGg, dnsWeb, pub, fb, ws, login, ...probe.checks, web, ops, bundle, ...local], relayLog: full ? probe.log : [] };
}

export const byId = (f: Findings) => new Map(f.checks.map((c) => [c.id, c]));
