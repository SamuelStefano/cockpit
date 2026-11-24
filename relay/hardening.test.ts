import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createRelay, type RelayStore, type RelayConfig } from './src/index';
import type { Identity } from './src/verify';

const store: RelayStore = {
  async agentById() { return null; }, async isAdmin() { return false; },
  async listAccounts() { return []; }, async setAdmin() { return true; },
  async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
  async consumePairingCode() { return null; }, async createAgent() { return null; },
      async listBoxes() { return []; }, async renameBox() { return false; }, async revokeBox() { return false; },
};

let server: Server | null = null;
const socks: WebSocket[] = [];
afterEach(() => { socks.forEach((s) => { try { s.terminate(); } catch { /* gone */ } }); socks.length = 0; server?.close(); server = null; });

async function start(extra: Partial<RelayConfig> = {}, seen: (string | null)[] = []) {
  const relay = createRelay({
    iss: 't', jwksUrl: 'http://x', rootEmails: '', store,
    resolveIdentity: async (tok): Promise<Identity | null> => { seen.push(tok); return tok ? { accountId: 'acc', email: 'a@x', role: 'fellow' } : null; },
    ...extra,
  });
  server = relay.server;
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  return (server.address() as AddressInfo).port;
}

const open = (url: string, protocols?: string[], origin?: string) => {
  const ws = new WebSocket(url, protocols, origin ? { headers: { origin } } : undefined);
  socks.push(ws);
  return ws;
};
// Resolves with 'open', the HTTP status of a rejected upgrade, or the close code.
const outcome = (ws: WebSocket) => new Promise<'open' | number>((resolve) => {
  ws.on('open', () => resolve('open'));
  ws.on('unexpected-response', (_q, res) => resolve(res.statusCode ?? 0));
  ws.on('close', (c) => resolve(c));
  ws.on('error', () => { /* reported via the other events */ });
});
const closeCode = (ws: WebSocket) => new Promise<number>((r) => ws.on('close', (c) => r(c)));

describe('origin allowlist', () => {
  const allowedOrigins = 'https://deck.example.com';
  it('/ws rejects an unlisted Origin and accepts a listed one', async () => {
    const port = await start({ allowedOrigins });
    expect(await outcome(open(`ws://127.0.0.1:${port}/ws?token=t`, undefined, 'https://evil.com'))).toBe(403);
    expect(await outcome(open(`ws://127.0.0.1:${port}/ws?token=t`, undefined, 'https://deck.example.com'))).toBe('open');
  });
  it('/agent allows no Origin but rejects a foreign one', async () => {
    const port = await start({ allowedOrigins });
    expect(await outcome(open(`ws://127.0.0.1:${port}/agent`))).toBe('open');
    expect(await outcome(open(`ws://127.0.0.1:${port}/agent`, undefined, 'https://evil.com'))).toBe(403);
  });
  it('unset keeps any origin working', async () => {
    const port = await start();
    expect(await outcome(open(`ws://127.0.0.1:${port}/ws?token=t`, undefined, 'https://anything.com'))).toBe('open');
  });
  it('CORS reflects only allowlisted origins', async () => {
    const port = await start({ allowedOrigins });
    const hit = (origin: string) => fetch(`http://127.0.0.1:${port}/pair/new`, { method: 'OPTIONS', headers: { origin } });
    expect((await hit('https://deck.example.com')).headers.get('access-control-allow-origin')).toBe('https://deck.example.com');
    expect((await hit('https://evil.com')).headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('connection caps', () => {
  it('caps concurrent sockets per client IP and frees the slot on close', async () => {
    const port = await start({ maxSocketsPerIp: 2 });
    const a = open(`ws://127.0.0.1:${port}/agent`); const b = open(`ws://127.0.0.1:${port}/agent`);
    expect(await outcome(a)).toBe('open'); expect(await outcome(b)).toBe('open');
    expect(await outcome(open(`ws://127.0.0.1:${port}/ws?token=t`))).toBe(429);
    const gone = closeCode(a); a.close(); await gone;
    await new Promise((r) => setTimeout(r, 50));
    expect(await outcome(open(`ws://127.0.0.1:${port}/agent`))).toBe('open');
  });
  it('uses the last X-Forwarded-For value from a loopback peer', async () => {
    const port = await start({ maxSocketsPerIp: 1 });
    const hdr = (ip: string) => ({ headers: { 'x-forwarded-for': `6.6.6.6, ${ip}` } });
    const a = new WebSocket(`ws://127.0.0.1:${port}/agent`, hdr('9.9.9.1')); socks.push(a);
    expect(await outcome(a)).toBe('open');
    const b = new WebSocket(`ws://127.0.0.1:${port}/agent`, hdr('9.9.9.2')); socks.push(b);
    expect(await outcome(b)).toBe('open');
    const c = new WebSocket(`ws://127.0.0.1:${port}/agent`, hdr('9.9.9.1')); socks.push(c);
    expect(await outcome(c)).toBe(429);
  });
  it('closes the NEW browser socket with 4429 past the per-account cap', async () => {
    const port = await start({ maxTabsPerAccount: 2 });
    const tabs = [open(`ws://127.0.0.1:${port}/ws?token=t`), open(`ws://127.0.0.1:${port}/ws?token=t`)];
    for (const t of tabs) await new Promise((r) => t.on('message', r));
    const third = open(`ws://127.0.0.1:${port}/ws?token=t`);
    expect(await closeCode(third)).toBe(4429);
    expect(tabs.every((t) => t.readyState === WebSocket.OPEN)).toBe(true);
  });
});

describe('pre-auth size guard on /agent', () => {
  it('closes 4413 on a big frame before auth', async () => {
    const port = await start();
    const ws = open(`ws://127.0.0.1:${port}/agent`);
    await new Promise((r) => ws.on('open', r));
    const code = closeCode(ws);
    ws.send('x'.repeat(17 * 1024));
    expect(await code).toBe(4413);
  });
});

describe('JWT via WebSocket subprotocol', () => {
  it('reads the bearer entry and selects deck.v1', async () => {
    const seen: (string | null)[] = [];
    const port = await start({}, seen);
    const ws = open(`ws://127.0.0.1:${port}/ws`, ['deck.v1', 'bearer.jwt-sub']);
    expect(await outcome(ws)).toBe('open');
    expect(ws.protocol).toBe('deck.v1');
    expect(seen).toEqual(['jwt-sub']);
  });
  it('prefers the subprotocol over ?token=, and keeps ?token= as fallback', async () => {
    const seen: (string | null)[] = [];
    const port = await start({}, seen);
    await outcome(open(`ws://127.0.0.1:${port}/ws?token=from-url`, ['deck.v1', 'bearer.from-proto']));
    await outcome(open(`ws://127.0.0.1:${port}/ws?token=from-url`));
    expect(seen).toEqual(['from-proto', 'from-url']);
  });
});
