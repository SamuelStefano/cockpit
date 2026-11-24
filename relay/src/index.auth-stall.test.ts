import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createRelay, type RelayStore } from './index';
import type { JwksFn } from './verify';

const store: RelayStore = {
  async agentById() { return null; }, async isAdmin() { return false; },
  async listAccounts() { return []; }, async setAdmin() { return true; },
  async markAgentSeen() {}, async createPairingCode() { return { code: 'C', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
  async consumePairingCode() { return null; }, async createAgent() { return null; },
  async listBoxes() { return []; }, async renameBox() { return false; }, async revokeBox() { return false; },
};

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const FORGED = `${b64({ alg: 'ES256', typ: 'JWT', kid: 'probe-unknown' })}.${b64({ sub: 'probe' })}.AAAA`;

let server: Server | null = null;
beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); server?.close(); server = null; });

const hang: JwksFn = (() => new Promise(() => {})) as unknown as JwksFn;
const rejecting: JwksFn = (() => Promise.reject(new Error('no key'))) as unknown as JwksFn;

async function connect(url: string): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
    ws.on('error', reject);
  });
}

describe('browser auth stall', () => {
  it('closes 4408 once on a stuck JWKS, swaps the instance, and the next login uses the new one', async () => {
    const instances: JwksFn[] = [hang, rejecting];
    const created: number[] = [];
    const relay = createRelay({
      iss: 't', jwksUrl: 'http://x', rootEmails: '', store, browserAuthStallMs: 150,
      jwksFactory: () => { created.push(created.length); return instances[Math.min(created.length - 1, instances.length - 1)]; },
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws?token=${FORGED}`;

    const first = await connect(url);
    expect(first).toEqual({ code: 4408, reason: 'auth timeout' });
    expect(created).toHaveLength(2);
    expect(relay.obs.recent().filter((e) => e.ev === 'browser_auth_stall')).toHaveLength(1);
    await vi.waitFor(() => expect(relay.obs.recent().filter((e) => e.ev === 'browser_close' && e.code === 4408)).toHaveLength(1));

    const second = await connect(url);
    expect(second.code).toBe(4401);
    expect(relay.obs.recent().filter((e) => e.ev === 'browser_auth_stall')).toHaveLength(1);
    expect(created).toHaveLength(2);
  });

  it('a forged token with a healthy JWKS still gets 4401', async () => {
    const relay = createRelay({ iss: 't', jwksUrl: 'http://x', rootEmails: '', store, jwksFactory: () => rejecting });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws?token=${FORGED}`;
    expect((await connect(url)).code).toBe(4401);
  });
});
