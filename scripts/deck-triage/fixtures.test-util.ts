import type { Check, CheckId, CheckStatus, Findings } from './checks.ts';

const GREEN: [CheckId, string][] = [
  ['dns_cf', 'A 163.176.220.63'], ['dns_google', 'A 163.176.220.63'], ['dns_web', 'A 178.105.2.230'], ['public_status', 'HTTP 200'],
  ['fallback_status', 'HTTP 200'], ['ws_upgrade', 'HTTP 101'], ['ssh', 'conectado'], ['relay_local', 'HTTP 200'], ['relay_active', 'active'],
  ['caddy_active', 'active'], ['dokploy_web', 'app done'], ['dokploy_ops', 'app done'], ['spa_bundle', 'ok'],
  ['local_agent_service', 'active'], ['local_agent_owner', 'pid 1'],
];

export function findings(over: Partial<Record<CheckId, [CheckStatus, string]>> = {}): Findings {
  const checks: Check[] = GREEN.map(([id, detail]) => {
    const o = over[id];
    return o ? { id, status: o[0], detail: o[1] } : { id, status: 'ok', detail };
  });
  return { at: '2026-10-28T16:00:00.000Z', checks, relayLog: [] };
}

export const dnsDeleted = (): Findings => findings({
  dns_cf: ['fail', 'sem registro A (ENOTFOUND)'],
  dns_google: ['fail', 'sem registro A (ENOTFOUND)'],
  public_status: ['fail', 'ENOTFOUND'],
  ws_upgrade: ['fail', 'ENOTFOUND'],
});
