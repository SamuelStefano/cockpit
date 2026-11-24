import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createRelay, type RelayStore } from './index';

const EMAIL = 'victim@example.com';
const RAW_ACCT = 'acct-raw-id-12345';
const IP = '203.0.113.77';

const store: RelayStore = {
  async agentById() { return null; }, async isAdmin() { return false; },
  async listAccounts() { return []; }, async setAdmin() { return true; },
  async markAgentSeen() {}, async createPairingCode() { return { code: 'PAIRCODE', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
  async consumePairingCode() { return null; }, async createAgent() { return null; },
  async listBoxes() { return []; }, async renameBox() { return false; }, async revokeBox() { return false; },
};

let server: Server | null = null;
let logs: string[] = [];
beforeEach(() => { logs = []; vi.spyOn(console, 'log').mockImplementation((m: unknown) => { logs.push(String(m)); }); });
afterEach(() => { vi.restoreAllMocks(); server?.close(); server = null; });

async function start(extra: Partial<Parameters<typeof createRelay>[0]> = {}) {
  const relay = createRelay({
    iss: 't', jwksUrl: 'http://x', rootEmails: '', store, logSalt: 'salt', revision: 'rev1',
    allowedOrigins: 'https://app.example.com', opsToken: 'ops-secret',
    resolveIdentity: async (t) => (t === 'good'
      ? { accountId: RAW_ACCT, email: EMAIL, role: 'user' } as never
      : null),
    ...extra,
  });
  server = relay.server;
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  return { relay, base };
}

const beacon = (base: string, body: string, headers: Record<string, string> = {}) =>
  fetch(`${base}/telemetry`, { method: 'POST', body, headers: { origin: 'https://app.example.com', 'content-type': 'text/plain', 'x-forwarded-for': IP, ...headers } });

describe('POST /telemetry', () => {
  it('204 on valid, drops unknown fields', async () => {
    const { base, relay } = await start();
    const r = await beacon(base, JSON.stringify({ v: 1, kind: 'ws_offline', closeCode: 1006, ua: 'safari', secret: 'zzz' }));
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBe('https://app.example.com');
    const e = relay.obs.recent().find((x) => x.ev === 'client_ws_offline')!;
    expect(e).toMatchObject({ code: 1006, ua: 'safari' });
    expect(e).not.toHaveProperty('secret');
  });
  it('answers OPTIONS', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/telemetry`, { method: 'OPTIONS', headers: { origin: 'https://app.example.com' } })).status).toBe(204);
  });
  it('413 above 2048 bytes', async () => {
    const { base } = await start();
    const r = await beacon(base, JSON.stringify({ v: 1, kind: 'ws_offline', closeReason: 'x'.repeat(3000) }));
    expect(r.status).toBe(413);
  });
  it('403 for a foreign origin', async () => {
    const { base } = await start();
    expect((await beacon(base, '{"v":1,"kind":"ws_offline"}', { origin: 'https://evil.example' })).status).toBe(403);
  });
  it('400 for invalid json or schema', async () => {
    const { base } = await start();
    expect((await beacon(base, 'not json')).status).toBe(400);
    expect((await beacon(base, '{"v":1,"kind":"bogus"}')).status).toBe(400);
  });
  it('429 after 30 per minute per IP', async () => {
    const { base } = await start();
    const body = '{"v":1,"kind":"ws_recovered"}';
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await beacon(base, body, { 'x-forwarded-for': '198.51.100.9' })).status;
    expect(last).toBe(429);
    expect((await beacon(base, body, { 'x-forwarded-for': '198.51.100.10' })).status).toBe(204);
  });
});

describe('GET /ops/stats', () => {
  it('401 wrong token, 200 right token', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/ops/stats`)).status).toBe(401);
    expect((await fetch(`${base}/ops/stats`, { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    const ok = await fetch(`${base}/ops/stats`, { headers: { authorization: 'Bearer ops-secret' } });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(await ok.json()).toMatchObject({ revision: 'rev1', live: { browsers: 0, agents: 0, boxesOnline: 0 } });
  });
  it('404 when no token is configured', async () => {
    const { base } = await start({ opsToken: undefined });
    expect((await fetch(`${base}/ops/stats`, { headers: { authorization: 'Bearer x' } })).status).toBe(404);
  });
  it('falls back to statusToken', async () => {
    const { base } = await start({ opsToken: undefined, statusToken: 'st' });
    expect((await fetch(`${base}/ops/stats`, { headers: { authorization: 'Bearer st' } })).status).toBe(200);
  });
  it('/ops serves the dashboard with a strict CSP', async () => {
    const { base } = await start();
    const r = await fetch(`${base}/ops`);
    expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await r.text()).toContain('/ops/stats');
  });
  it('records connection events without PII', async () => {
    const { base, relay } = await start();
    await beacon(base, '{"v":1,"kind":"auth_rejected","closeCode":4401}');
    const port = new URL(base).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, ['deck.v1', 'bearer.good'], { headers: { origin: 'https://app.example.com', 'x-forwarded-for': IP } });
    await new Promise<void>((res) => ws.on('message', () => res()));
    ws.close(1000, 'bye');
    await new Promise<void>((res) => ws.on('close', () => res()));
    await new Promise((r) => setTimeout(r, 50));
    const bad = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: { origin: 'https://evil.example' } });
    await new Promise<void>((res) => { bad.on('error', () => res()); bad.on('close', () => res()); });
    await fetch(`${base}/status`);

    const evs = relay.obs.recent().map((e) => e.ev);
    expect(evs).toEqual(expect.arrayContaining(['relay_start', 'browser_open', 'browser_auth_ok', 'browser_close', 'origin_reject', 'status']));
    const stats = await (await fetch(`${base}/ops/stats`, { headers: { authorization: 'Bearer ops-secret' } })).text();
    const everything = stats + logs.join('\n');
    for (const secret of [EMAIL, RAW_ACCT, IP, 'bearer.good', 'PAIRCODE']) expect(everything).not.toContain(secret);
    expect(relay.obs.recent().find((e) => e.ev === 'browser_auth_ok')!.acct).toBe(relay.obs.hid(RAW_ACCT));
    expect(relay.obs.counters()['browser_close:1000']).toBe(1);
  });
});
