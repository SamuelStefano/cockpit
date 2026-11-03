import { describe, it, expect, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createRelay, type RelayStore } from './index';

let server: Server | null = null;
afterEach(() => { server?.close(); server = null; });

const store = (minted: string[], over: Partial<RelayStore> = {}): RelayStore => ({
  async agentById() { return null; }, async isAdmin() { return false; },
  async listAccounts() { return []; }, async setAdmin() { return true; },
  async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: '' }; },
  async consumePairingCode() { return null; }, async createAgent() { return null; },
  async listBoxes() { return []; }, async renameBox() { return false; }, async revokeBox() { return false; },
  async mintLoginToken(id) { minted.push(id); return `hash-${id}`; },
  ...over,
});

const ids: Record<string, { accountId: string; email: string; role: 'fellow'; expMs: number }> = {
  user: { accountId: 'accA', email: 'a@x', role: 'fellow', expMs: Date.now() + 3600_000 },
  other: { accountId: 'accB', email: 'b@x', role: 'fellow', expMs: Date.now() + 3600_000 },
};

async function listen(s: RelayStore, allowedOrigins?: string) {
  const relay = createRelay({ iss: 't', jwksUrl: 'http://x', rootEmails: '', store: s, allowedOrigins, resolveIdentity: async (tok) => (tok && ids[tok]) || null });
  server = relay.server;
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  return (route: string, body?: unknown, token?: string, headers: Record<string, string> = {}) => fetch(`${base}/auth/qr/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('QR sign-in: ticket (signed-in device shows the QR)', () => {
  it('mints for the caller and redeems once for that account', async () => {
    const minted: string[] = [];
    const post = await listen(store(minted));
    expect((await post('ticket')).status).toBe(401);
    const t = await (await post('ticket', undefined, 'user')).json() as { ticket: string };
    const r = await post('redeem', { ticket: t.ticket });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ tokenHash: 'hash-accA' });
    expect((await post('redeem', { ticket: t.ticket })).status).toBe(410);
    expect((await post('redeem', { ticket: 'x'.repeat(43) })).status).toBe(410);
    expect(minted).toEqual(['accA']);
  });

  it('answers 501 when the store cannot mint, and 502 when it fails', async () => {
    const post = await listen(store([], { mintLoginToken: undefined }));
    expect((await post('ticket', undefined, 'user')).status).toBe(501);
    server?.close();
    const post2 = await listen(store([], { async mintLoginToken() { throw new Error('boom'); } }));
    const t = await (await post2('ticket', undefined, 'user')).json() as { ticket: string };
    expect((await post2('redeem', { ticket: t.ticket })).status).toBe(502);
  });

  it('refuses a foreign origin when origins are configured', async () => {
    const post = await listen(store([]), 'https://deck.example');
    expect((await post('request', undefined, undefined, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post('request', undefined, undefined, { origin: 'https://deck.example' })).status).toBe(200);
  });
});

describe('QR sign-in: request (login screen shows the QR)', () => {
  it('logs in only after approval, only with the secret, only once', async () => {
    const minted: string[] = [];
    const post = await listen(store(minted));
    const r = await (await post('request', undefined, undefined, { 'user-agent': 'Phone Safari' })).json() as { id: string; secret: string; code: string };
    expect(await (await post('poll', { id: r.id, secret: r.secret })).json()).toEqual({ status: 'pending' });
    expect((await post('peek', { id: r.id })).status).toBe(401);
    expect(await (await post('peek', { id: r.id }, 'user')).json()).toMatchObject({ ua: 'Phone Safari' });
    expect((await post('answer', { id: r.id, approve: true }, 'user')).status).toBe(422);
    expect((await post('answer', { id: r.id, approve: true, code: r.code }, 'user')).status).toBe(200);
    expect((await post('answer', { id: r.id, approve: true, code: r.code }, 'other')).status).toBe(410);
    expect((await post('poll', { id: r.id, secret: 'y'.repeat(43) })).status).toBe(410);
    const ok = await post('poll', { id: r.id, secret: r.secret });
    expect(await ok.json()).toEqual({ status: 'approved', tokenHash: 'hash-accA' });
    expect((await post('poll', { id: r.id, secret: r.secret })).status).toBe(410);
    expect(minted).toEqual(['accA']);
  });

  it('a refusal ends the request without minting', async () => {
    const minted: string[] = [];
    const post = await listen(store(minted));
    const r = await (await post('request')).json() as { id: string; secret: string };
    expect((await post('answer', { id: r.id, approve: false }, 'user')).status).toBe(200);
    expect((await post('poll', { id: r.id, secret: r.secret })).status).toBe(410);
    expect(minted).toEqual([]);
  });

  it('burns the request after three wrong codes', async () => {
    const post = await listen(store([]));
    const r = await (await post('request')).json() as { id: string; secret: string; code: string };
    const wrong = r.code === '0000' ? '1111' : '0000';
    for (let i = 0; i < 3; i++) expect((await post('answer', { id: r.id, approve: true, code: wrong }, 'user')).status).toBe(422);
    expect((await post('answer', { id: r.id, approve: true, code: r.code }, 'user')).status).toBe(410);
  });

  it('rejects malformed bodies', async () => {
    const post = await listen(store([]));
    expect((await post('answer', { id: 'short', approve: true }, 'user')).status).toBe(400);
    expect((await post('answer', { id: 'x'.repeat(43) }, 'user')).status).toBe(400);
    expect((await post('poll', 'x'.repeat(2000))).status).toBe(400);
  });
});
