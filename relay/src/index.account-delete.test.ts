import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createRelay, type RelayStore } from './index';

let server: Server | null = null;
afterEach(() => { server?.close(); server = null; });

const baseStore = (over: Partial<RelayStore>): RelayStore => ({
  async agentById() { return null; }, async isAdmin() { return false; },
  async listAccounts() { return []; }, async setAdmin() { return true; },
  async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
  async consumePairingCode() { return null; }, async createAgent() { return null; },
  async listBoxes() { return []; }, async renameBox() { return false; }, async revokeBox() { return false; },
  ...over,
});

const ids: Record<string, { accountId: string; email: string; role: 'fellow' | 'root'; expMs?: number }> = {
  user: { accountId: 'accA', email: 'a@x', role: 'fellow', expMs: Date.now() + 3600_000 },
  other: { accountId: 'accB', email: 'b@x', role: 'fellow', expMs: Date.now() + 3600_000 },
  root: { accountId: 'accR', email: 'r@x', role: 'root', expMs: Date.now() + 3600_000 },
};

async function listen(store: RelayStore) {
  const relay = createRelay({ iss: 't', jwksUrl: 'http://x', rootEmails: '', store, resolveIdentity: async (tok) => (tok && ids[tok]) || null });
  server = relay.server;
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}
const del = (base: string, token?: string) =>
  fetch(`${base}/account/delete`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} });

describe('POST /account/delete', () => {
  it('deletes only the caller account, from the JWT', async () => {
    const calls: string[] = [];
    const base = await listen(baseStore({ async deleteAccount(id) { calls.push(id); return true; } }));
    const res = await del(base, 'user');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls).toEqual(['accA']);
  });

  it('needs a valid Bearer header and ignores a token in the query string', async () => {
    const calls: string[] = [];
    const base = await listen(baseStore({ async deleteAccount(id) { calls.push(id); return true; } }));
    expect((await del(base)).status).toBe(401);
    expect((await del(base, 'nope')).status).toBe(401);
    expect((await fetch(`${base}/account/delete?token=user`, { method: 'POST' })).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('refuses root accounts', async () => {
    const calls: string[] = [];
    const base = await listen(baseStore({ async deleteAccount(id) { calls.push(id); return true; } }));
    expect((await del(base, 'root')).status).toBe(403);
    expect(calls).toEqual([]);
  });

  it('is idempotent: a repeat call succeeds again', async () => {
    let n = 0;
    const base = await listen(baseStore({ async deleteAccount() { n++; return true; } }));
    expect((await del(base, 'user')).status).toBe(200);
    expect((await del(base, 'user')).status).toBe(200);
    expect(n).toBe(2);
  });

  it('answers 502 when the store fails, and a retry can still succeed', async () => {
    let fail = true;
    const base = await listen(baseStore({ async deleteAccount() { if (fail) throw new Error('boom'); return true; } }));
    expect((await del(base, 'user')).status).toBe(502);
    fail = false;
    expect((await del(base, 'user')).status).toBe(200);
  });

  it('answers 501 when the store cannot delete', async () => {
    const base = await listen(baseStore({}));
    expect((await del(base, 'user')).status).toBe(501);
  });

  it('rate limits to 3 per minute per account', async () => {
    const base = await listen(baseStore({ async deleteAccount() { return true; } }));
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await del(base, 'user')).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    expect((await del(base, 'other')).status).toBe(200);
  });

  it('allows the browser preflight (CORS)', async () => {
    const base = await listen(baseStore({}));
    const res = await fetch(`${base}/account/delete`, { method: 'OPTIONS', headers: { origin: 'https://deck.devfellowship.com' } });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('closes the live sockets of the deleted account and refuses it afterwards', async () => {
    const base = await listen(baseStore({ async deleteAccount() { return true; } }));
    const url = base.replace('http', 'ws');
    const open = (tok: string) => new Promise<{ ws: WebSocket; closed: Promise<number> }>((resolve) => {
      const ws = new WebSocket(`${url}/ws?token=${tok}`);
      const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
      ws.on('message', function first() { ws.off('message', first); resolve({ ws, closed }); });
    });
    const mine = await open('user');
    const theirs = await open('other');
    expect((await del(base, 'user')).status).toBe(200);
    expect(await mine.closed).toBe(4403);
    expect(theirs.ws.readyState).toBe(WebSocket.OPEN);
    theirs.ws.close();
    const again = new WebSocket(`${url}/ws?token=user`);
    const code = await new Promise<number>((r) => again.on('close', (c) => r(c)));
    expect(code).toBe(4401);
  });
});
