import { describe, expect, it, vi } from 'vitest';
import { login, type LoginDeps } from './auth.ts';
import { createRateLimiter } from './rateLimit.ts';

const ADMIN = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER = 'bbbbbbbb-0000-0000-0000-000000000002';

function deps(userId: string | null, status = 200): LoginDeps & { fetchImpl: ReturnType<typeof vi.fn> } {
  const fetchImpl = vi.fn(async (url: string) => {
    if (String(url).includes('/logout')) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(userId ? { access_token: 'tok', user: { id: userId } } : { error: 'invalid_grant' }), { status });
  });
  return {
    supabaseUrl: 'https://p.supabase.co',
    anonKey: 'anon',
    adminIds: new Set([ADMIN]),
    perIp: createRateLimiter(5, 900_000, () => 0),
    global: createRateLimiter(30, 900_000, () => 0),
    fetchImpl: fetchImpl as never,
  };
}

describe('login', () => {
  it('lets an allowlisted user in and revokes the Supabase session', async () => {
    const d = deps(ADMIN);
    expect(await login(d, '1.1.1.1', 'a@b.c', 'pw')).toEqual({ ok: true, userId: ADMIN });
    const [url, init] = d.fetchImpl.mock.calls[0];
    expect(url).toBe('https://p.supabase.co/auth/v1/token?grant_type=password');
    expect(init.headers.apikey).toBe('anon');
    expect(d.fetchImpl.mock.calls.some(([u]) => String(u).includes('/auth/v1/logout'))).toBe(true);
  });

  it('denies a valid user outside the allowlist', async () => {
    expect(await login(deps(OTHER), '1.1.1.1', 'a@b.c', 'pw')).toEqual({ ok: false, reason: 'denied' });
  });

  it('denies a wrong password', async () => {
    expect(await login(deps(null, 400), '1.1.1.1', 'a@b.c', 'bad')).toEqual({ ok: false, reason: 'denied' });
  });

  it('treats an unreachable auth server as an error, not a denial', async () => {
    const d = deps(ADMIN);
    d.fetchImpl.mockRejectedValueOnce(new Error('down'));
    expect(await login(d, '1.1.1.1', 'a@b.c', 'pw')).toEqual({ ok: false, reason: 'error' });
  });

  it('rate-limits per IP before calling Supabase', async () => {
    const d = deps(null, 400);
    for (let i = 0; i < 5; i++) await login(d, '9.9.9.9', 'a@b.c', 'x');
    const calls = d.fetchImpl.mock.calls.length;
    expect(await login(d, '9.9.9.9', 'a@b.c', 'x')).toEqual({ ok: false, reason: 'rate' });
    expect(d.fetchImpl.mock.calls.length).toBe(calls);
    expect((await login(d, '8.8.8.8', 'a@b.c', 'x')).ok).toBe(false);
  });

  it('rate-limits globally across IPs', async () => {
    const d = deps(null, 400);
    for (let i = 0; i < 30; i++) await login(d, `10.0.0.${i}`, 'a@b.c', 'x');
    expect(await login(d, '10.0.1.1', 'a@b.c', 'x')).toEqual({ ok: false, reason: 'rate' });
  });
});
