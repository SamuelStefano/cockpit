import { describe, expect, it, vi } from 'vitest';
import { AUTH_FLOW_MIN_STALLS, authFlowCheck, loginCheck, PROBE_TOKEN, runChecks } from './checks.ts';

describe('PROBE_TOKEN', () => {
  it('is an unsigned ES256 JWT with an unknown kid', () => {
    const [h, p, sig] = PROBE_TOKEN.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', typ: 'JWT', kid: 'probe-unknown' });
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toEqual({ sub: 'probe' });
    expect(sig).toBe('AAAA');
  });
});

describe('loginCheck', () => {
  const clock = (...ts: number[]) => { const q = [...ts]; return () => q.shift() ?? 0; };

  it('is ok on a fast 4401 and passes the forged token and web origin', async () => {
    const probe = vi.fn(async () => 4401);
    const c = await loginCheck(probe, clock(0, 120));
    expect(c).toMatchObject({ id: 'login_path', status: 'ok', detail: '4401 em 120 ms', metrics: { login_ms: 120 } });
    const [url, origin] = probe.mock.calls[0] as unknown as [string, string];
    expect(url).toBe(`wss://deck-relay.devfellowship.com/ws?token=${PROBE_TOKEN}`);
    expect(origin).toBe('https://deck.devfellowship.com');
  });

  it('fails on a slow 4401', async () => {
    const c = await loginCheck(async () => 4401, clock(0, 6_000));
    expect(c.status).toBe('fail');
    expect(c.detail).toContain('lento');
  });

  it('fails on 4408 and on any other code', async () => {
    expect((await loginCheck(async () => 4408, clock(0, 8_100))).detail).toContain('4408');
    expect((await loginCheck(async () => 1006, clock(0, 10))).status).toBe('fail');
  });

  it('fails when the probe throws', async () => {
    const c = await loginCheck(async () => { throw new Error('sem fechamento em 12s'); });
    expect(c).toMatchObject({ status: 'fail', detail: expect.stringContaining('12s') });
  });

  it('fails at the 12 s hard timeout when the probe never answers', async () => {
    vi.useFakeTimers();
    try {
      const p = loginCheck(() => new Promise<number>(() => {}));
      await vi.advanceTimersByTimeAsync(12_001);
      expect(await p).toMatchObject({ status: 'fail', detail: expect.stringContaining('timeout') });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('authFlowCheck', () => {
  it('fails when 4408 reaches the threshold with no successful login', () => {
    const c = authFlowCheck(`ok=0 c4408=${AUTH_FLOW_MIN_STALLS} stall=2`);
    expect(c).toMatchObject({ id: 'auth_flow', status: 'fail', metrics: { auth_ok: 0, close_4408: 3, stall: 2 } });
  });

  it('is ok when logins succeed or 4408 is rare', () => {
    expect(authFlowCheck('ok=5 c4408=9 stall=0').status).toBe('ok');
    expect(authFlowCheck('ok=0 c4408=2 stall=0').status).toBe('ok');
    expect(authFlowCheck('ok=0 c4408=0 stall=0').detail).toContain('0 login(s) ok');
  });

  it('warns on unparseable or non-numeric output instead of trusting it', () => {
    for (const bad of [undefined, '', 'ok=x c4408=1 stall=0', 'ok=1 c4408=1 stall=0; reboot', 'ok=99999999 c4408=1 stall=0']) {
      expect(authFlowCheck(bad).status).toBe('warn');
    }
  });
});

describe('runChecks', () => {
  it('includes login_path in the synthetic scope and auth_flow from the probe', async () => {
    const out = '@@status\n200\n@@relay\nactive\n@@caddy\nactive\n@@log\n\n@@auth\nok=0 c4408=4 stall=1\n@@end\n';
    const f = await runChecks({
      cfg: { relay: { host: 'x', keyFile: 'y' }, dokploy: null, localRepo: '/x' },
      runner: async () => ({ code: 0, stdout: out, stderr: '', timedOut: false }),
      fetchImpl: (async () => new Response('<html></html>', { status: 200 })) as never,
      resolve4: async () => ['163.176.220.63'],
      wsUpgrade: async () => 101,
      loginProbe: async () => 4401,
    }, null, 'synthetic');
    const by = new Map(f.checks.map((c) => [c.id, c]));
    expect(by.get('login_path')?.status).toBe('ok');
    expect(by.get('auth_flow')?.status).toBe('fail');
  });
});
