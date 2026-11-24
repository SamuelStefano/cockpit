import { describe, expect, it } from 'vitest';
import { createActionGate, executeAction, HOURLY_CAP, isActionId } from './actions.ts';
import type { Runner } from './exec.ts';

const MIN = 60_000;

describe('action allowlist', () => {
  it('knows only the fixed actions', () => {
    expect(isActionId('restart_relay')).toBe(true);
    expect(isActionId('rm_rf')).toBe(false);
    expect(isActionId('toString')).toBe(false);
    expect(isActionId('__proto__')).toBe(false);
  });

  it('the gate refuses an unknown action', () => {
    expect(createActionGate(() => 0).check('sudo reboot')).toEqual({ ok: false, reason: 'ação fora da allowlist' });
  });
});

describe('createActionGate', () => {
  it('enforces the per-action cooldown', () => {
    let t = 0;
    const g = createActionGate(() => t);
    expect(g.check('restart_relay').ok).toBe(true);
    g.record('restart_relay');
    t = 5 * MIN;
    expect(g.check('restart_relay')).toEqual({ ok: false, reason: 'em cooldown, de novo em 5 min' });
    expect(g.check('reload_caddy').ok).toBe(true);
    t = 10 * MIN;
    expect(g.check('restart_relay').ok).toBe(true);
  });

  it('caps actions per hour across kinds', () => {
    let t = 0;
    const g = createActionGate(() => t, 2);
    g.record('restart_relay');
    t += MIN;
    g.record('reload_caddy');
    t += MIN;
    expect(g.check('redeploy_web')).toEqual({ ok: false, reason: 'limite de 2 ações por hora atingido' });
    t = 61 * MIN;
    expect(g.check('redeploy_web').ok).toBe(true);
  });

  it('ignore never hits cooldown or cap', () => {
    const g = createActionGate(() => 0, 0);
    g.record('ignore');
    expect(g.check('ignore').ok).toBe(true);
    expect(HOURLY_CAP).toBeGreaterThan(0);
  });
});

describe('executeAction', () => {
  const cfg = { relay: { host: 'ubuntu@h', keyFile: '/k' }, dokploy: null, localRepo: '/nonexistent' };

  it('restart_relay sends the fixed script over ssh stdin', async () => {
    const calls: { cmd: string; args: string[]; input?: string }[] = [];
    const runner: Runner = async (cmd, args, opts) => { calls.push({ cmd, args, input: opts?.input }); return { code: 0, stdout: '', stderr: '', timedOut: false }; };
    await executeAction('restart_relay', { cfg, runner });
    expect(calls).toEqual([{ cmd: 'ssh', args: expect.arrayContaining(['ubuntu@h', 'bash -s', 'BatchMode=yes']), input: 'sudo -n systemctl restart deck-relay' }]);
  });

  it('redeploy without Dokploy credentials fails loudly', async () => {
    await expect(executeAction('redeploy_web', { cfg })).rejects.toThrow(/Dokploy/);
  });

  it('redeploy posts the fixed app id', async () => {
    const seen: { url: string; body: string }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => { seen.push({ url, body: String(init.body) }); return new Response('{}'); }) as unknown as typeof fetch;
    await executeAction('redeploy_ops', { cfg: { ...cfg, dokploy: { url: 'https://d', header: 'x-api-key', token: 't' } }, fetchImpl });
    expect(seen).toEqual([{ url: 'https://d/api/trpc/application.redeploy', body: '{"json":{"applicationId":"_fu5zkgq_89jpNtJVlxXS"}}' }]);
  });
});
