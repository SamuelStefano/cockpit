import { appendFile } from 'node:fs/promises';
import { APPS, type TriageConfig } from './config.ts';
import { run, ssh, type Runner } from './exec.ts';
import { findOwnerAgentPids, type CheckId } from './checks.ts';
import { cleanText } from './sanitize.ts';

const MIN = 60_000;

export const ACTIONS = {
  restart_relay: { label: 'Reiniciar relay', cooldownMs: 10 * MIN, recheck: ['relay_local', 'relay_active', 'public_status', 'fallback_status'] },
  reload_caddy: { label: 'Recarregar Caddy', cooldownMs: 10 * MIN, recheck: ['caddy_active', 'public_status', 'fallback_status'] },
  redeploy_web: { label: 'Redeploy deck-web', cooldownMs: 20 * MIN, recheck: ['dokploy_web', 'spa_bundle'] },
  redeploy_ops: { label: 'Redeploy deck-ops', cooldownMs: 20 * MIN, recheck: ['dokploy_ops'] },
  restart_local_agent: { label: 'Reiniciar agente local', cooldownMs: 10 * MIN, recheck: ['local_agent_service', 'local_agent_owner'] },
  ignore: { label: 'Ignorar', cooldownMs: 0, recheck: [] },
} as const satisfies Record<string, { label: string; cooldownMs: number; recheck: CheckId[] }>;

export type ActionId = keyof typeof ACTIONS;
export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[];
export const isActionId = (s: unknown): s is ActionId => typeof s === 'string' && Object.hasOwn(ACTIONS, s);

export const HOURLY_CAP = 6;

export type GateResult = { ok: true } | { ok: false; reason: string };

// Every non-ignore action counts toward one shared hourly cap, plus its own cooldown.
export function createActionGate(now: () => number = Date.now, hourlyCap = HOURLY_CAP) {
  const last = new Map<ActionId, number>();
  let times: number[] = [];
  return {
    check(id: string): GateResult {
      if (!isActionId(id)) return { ok: false, reason: 'ação fora da allowlist' };
      if (id === 'ignore') return { ok: true };
      const t = now();
      const prev = last.get(id);
      const cd = ACTIONS[id].cooldownMs;
      if (prev !== undefined && t - prev < cd) return { ok: false, reason: `em cooldown, de novo em ${Math.ceil((cd - (t - prev)) / MIN)} min` };
      times = times.filter((x) => t - x < 60 * MIN);
      if (times.length >= hourlyCap) return { ok: false, reason: `limite de ${hourlyCap} ações por hora atingido` };
      return { ok: true };
    },
    record(id: ActionId): void {
      if (id === 'ignore') return;
      const t = now();
      last.set(id, t);
      times.push(t);
    },
  };
}

export interface ActionDeps {
  cfg: Pick<TriageConfig, 'relay' | 'dokploy' | 'localRepo'>;
  runner?: Runner;
  fetchImpl?: typeof fetch;
}

async function dokployRedeploy(deps: ActionDeps, appId: string): Promise<string> {
  const d = deps.cfg.dokploy;
  if (!d) throw new Error('sem credenciais do Dokploy');
  const res = await (deps.fetchImpl ?? fetch)(`${d.url}/api/trpc/application.redeploy`, {
    method: 'POST',
    headers: { [d.header]: d.token, 'content-type': 'application/json' },
    body: JSON.stringify({ json: { applicationId: appId } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Dokploy HTTP ${res.status}`);
  return 'redeploy enfileirado no Dokploy';
}

async function remote(deps: ActionDeps, script: string): Promise<string> {
  const r = await ssh(deps.runner ?? run, deps.cfg.relay, script, 60_000);
  if (r.code !== 0) throw new Error(`exit ${r.code}${r.timedOut ? ' (timeout)' : ''}: ${cleanText(r.stderr, 160)}`);
  return 'ok';
}

// Fixed argv per action. Nothing here takes text from a report or from the model.
export async function executeAction(id: ActionId, deps: ActionDeps): Promise<string> {
  const runner = deps.runner ?? run;
  switch (id) {
    case 'restart_relay': return remote(deps, 'sudo -n systemctl restart deck-relay');
    case 'reload_caddy': return remote(deps, 'sudo -n systemctl reload-or-restart caddy');
    case 'redeploy_web': return dokployRedeploy(deps, APPS.web);
    case 'redeploy_ops': return dokployRedeploy(deps, APPS.ops);
    case 'restart_local_agent': {
      const svc = await runner('sudo', ['-n', 'systemctl', 'restart', 'deck-agent'], { timeoutMs: 30_000 });
      const pids = await findOwnerAgentPids(deps.cfg.localRepo);
      for (const pid of pids) { try { process.kill(pid, 'SIGTERM'); } catch { /* already gone */ } }
      const svcMsg = svc.code === 0 ? 'deck-agent reiniciado' : `deck-agent falhou (${cleanText(svc.stderr, 80)})`;
      return `${svcMsg}; agente do dono: ${pids.length ? `SIGTERM em ${pids.join(',')}, o supervisor reergue (turnos em voo foram cortados)` : 'nenhum processo encontrado'}`;
    }
    case 'ignore': return 'ignorado';
  }
}

export async function logAction(file: string, entry: Record<string, unknown>): Promise<void> {
  await appendFile(file, `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`, { mode: 0o600 }).catch(() => {});
}
