import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { OpsData } from './data.ts';
import { createRateLimiter } from './rateLimit.ts';
import { createHandler, SECURITY_HEADERS } from './server.ts';
import { signSession } from './session.ts';

const SECRET = 's'.repeat(40);
const ADMIN = 'aaaaaaaa-0000-0000-0000-000000000001';
const ORIGIN = 'https://ops.example';

const data: OpsData = {
  listReports: vi.fn(async () => []),
  getReport: vi.fn(async () => null),
  reportsSince: async () => [],
  listAgents: async () => [],
  emails: async () => new Map(),
};

let server: Server;
let base = '';
const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ access_token: 't', user: { id: ADMIN } })));

beforeAll(async () => {
  server = createServer(createHandler({
    sessionSecret: SECRET,
    adminIds: new Set([ADMIN]),
    publicOrigin: ORIGIN,
    login: { supabaseUrl: 'https://p.supabase.co', anonKey: 'a', adminIds: new Set([ADMIN]), perIp: createRateLimiter(5, 1e6, () => 0), global: createRateLimiter(30, 1e6, () => 0), fetchImpl: fetchImpl as never },
    data,
    health: async () => ({ ok: true, text: 'relay ok' }),
    now: () => 1000,
    log: () => {},
  }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const cookie = `__Host-ops_session=${signSession(SECRET, ADMIN, 1000)}`;
const get = (path: string, headers: Record<string, string> = {}) => fetch(`${base}${path}`, { headers, redirect: 'manual' });
const post = (path: string, body: string, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, redirect: 'manual' });

describe('ops server', () => {
  it('sends the security headers on every response', async () => {
    for (const res of [await get('/healthz'), await get('/login'), await get('/reports'), await get('/nope', { cookie }), await post('/login', '')]) {
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(k)).toBe(v);
    }
  });

  it('answers /healthz without a session', async () => {
    const res = await get('/healthz');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('redirects to login without a valid session', async () => {
    expect((await get('/reports')).headers.get('location')).toBe('/login');
    expect((await get('/boxes', { cookie: `${cookie}x` })).headers.get('location')).toBe('/login');
    expect((await get('/reports', { cookie })).status).toBe(200);
  });

  it('refuses a cross-origin POST', async () => {
    expect((await post('/login', 'email=a&password=b', { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post('/login', 'email=a&password=b')).status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('logs in an allowlisted user with a hardened cookie', async () => {
    const res = await post('/login', 'email=a%40b.c&password=pw', { origin: ORIGIN });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/reports');
    expect(res.headers.get('set-cookie')).toMatch(/__Host-ops_session=v1\..*HttpOnly; Secure; SameSite=Strict/);
  });

  it('logs out by clearing the cookie', async () => {
    const res = await post('/logout', '', { origin: ORIGIN, cookie });
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('never queries the database with an invalid filter', async () => {
    vi.mocked(data.listReports).mockClear();
    await get('/reports?kind=x%27%3Bdrop&source=evil', { cookie });
    expect(data.listReports).not.toHaveBeenCalled();
    await get('/reports?kind=js-error&source=browser', { cookie });
    expect(data.listReports).toHaveBeenCalledWith({ accountIds: undefined, boxIds: undefined, source: 'browser', kind: 'js-error', limit: 100 });
  });
});
