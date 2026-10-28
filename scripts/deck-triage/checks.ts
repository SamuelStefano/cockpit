import { Resolver } from 'node:dns/promises';
import { readdir, readFile, readlink } from 'node:fs/promises';
import { APPS, RELAY_FALLBACK, RELAY_HOSTNAME, RELAY_IP, SPA_URL, type TriageConfig } from './config.ts';
import { run, ssh, withTimeout, type Runner } from './exec.ts';
import { parseSections, probeScript } from './relay.ts';
import { cleanText } from './sanitize.ts';

export type CheckId =
  | 'dns_cf' | 'dns_google' | 'public_status' | 'fallback_status' | 'ssh' | 'relay_local' | 'relay_active'
  | 'caddy_active' | 'dokploy_web' | 'dokploy_ops' | 'spa_bundle' | 'agents' | 'local_agent_service' | 'local_agent_owner';
export type CheckStatus = 'ok' | 'fail' | 'warn' | 'skip';
export interface Check { id: CheckId; status: CheckStatus; detail: string }
export interface Findings { at: string; checks: Check[]; relayLog: string[] }

export const CHECK_LABELS: Record<CheckId, string> = {
  dns_cf: 'DNS (1.1.1.1)',
  dns_google: 'DNS (8.8.8.8)',
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
};

export interface CheckDeps {
  cfg: Pick<TriageConfig, 'relay' | 'dokploy' | 'localRepo'>;
  runner?: Runner;
  fetchImpl?: typeof fetch;
  resolve4?: (server: string, host: string) => Promise<string[]>;
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

async function bundleCheck(f: typeof fetch): Promise<Check> {
  const id: CheckId = 'spa_bundle';
  try {
    const html = await (await f(`${SPA_URL}/`, { signal: AbortSignal.timeout(T) })).text();
    const src = /<script[^>]+type="module"[^>]+src="(\/assets\/[A-Za-z0-9._-]+\.js)"/.exec(html)?.[1];
    if (!src) return { id, status: 'fail', detail: 'index.html sem script de entrada' };
    const js = await (await f(`${SPA_URL}${src}`, { signal: AbortSignal.timeout(15_000) })).text();
    const hosts = [RELAY_HOSTNAME, RELAY_FALLBACK].filter((h) => js.includes(`wss://${h}`));
    if (!hosts.length) return { id, status: 'fail', detail: `${src} não contém wss://${RELAY_HOSTNAME}` };
    return { id, status: 'ok', detail: `${src} usa ${hosts.join(' + ')}` };
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
  const parts = live.slice(0, 4).map((r) => `${cleanText(r.label || r.id?.slice(0, 8), 30)} visto ${cleanText(r.last_seen ?? 'nunca', 25)}`);
  return { id, status: live.length ? 'ok' : 'warn', detail: `${live.length} ativa(s): ${parts.join('; ')}` };
}

async function relayProbe(deps: CheckDeps, accountId: string | null): Promise<{ checks: Check[]; log: string[] }> {
  const res = await ssh(deps.runner ?? run, deps.cfg.relay, probeScript(accountId), 25_000);
  if (res.code === null || res.code === 255 || !res.stdout.includes('@@end')) {
    const why = res.timedOut ? 'timeout' : cleanText(res.stderr, 100) || `exit ${res.code}`;
    const ids: CheckId[] = ['relay_local', 'relay_active', 'caddy_active'];
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

export async function runChecks(deps: CheckDeps, accountId: string | null, now = () => new Date()): Promise<Findings> {
  const f = deps.fetchImpl ?? fetch;
  const resolve4 = deps.resolve4 ?? defaultResolve4;
  const guard = <T>(p: Promise<T>, fallback: T) => withTimeout(p, 40_000, 'check').catch(() => fallback);
  const [dnsCf, dnsGg, pub, fb, probe, web, ops, bundle, local] = await Promise.all([
    dnsCheck('dns_cf', '1.1.1.1', resolve4),
    dnsCheck('dns_google', '8.8.8.8', resolve4),
    httpStatus('public_status', `https://${RELAY_HOSTNAME}/status`, f),
    httpStatus('fallback_status', `https://${RELAY_FALLBACK}/status`, f),
    guard(relayProbe(deps, accountId), { checks: [{ id: 'ssh' as const, status: 'fail' as const, detail: 'timeout' }], log: [] }),
    dokployCheck('dokploy_web', APPS.web, deps),
    dokployCheck('dokploy_ops', APPS.ops, deps),
    bundleCheck(f),
    guard(localAgentChecks(deps), []),
  ]);
  return { at: now().toISOString(), checks: [dnsCf, dnsGg, pub, fb, ...probe.checks, web, ops, bundle, ...local], relayLog: probe.log };
}

export const byId = (f: Findings) => new Map(f.checks.map((c) => [c.id, c]));
