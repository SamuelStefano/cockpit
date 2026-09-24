import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { createRelay, type RelayStore } from './src/index';

const store: RelayStore = {
  async agentById() { return null; }, async isAdmin() { return false; },
  async listAccounts() { return []; }, async setAdmin() { return true; },
  async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
  async consumePairingCode() { return null; }, async createAgent() { return null; },
};

describe('browser socket and the JWT expiry', () => {
  let server: import('node:http').Server | null = null;
  afterEach(() => { server?.close(); server = null; });

  it('is closed (non-4401, so the client redials) when the token expires', async () => {
    const relay = createRelay({
      iss: 't', jwksUrl: 'http://x', rootEmails: '', store,
      resolveIdentity: async () => ({ accountId: 'acc', email: 'a@x', role: 'fellow', expMs: Date.now() + 800 }),
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;
    const ws = new WebSocket(`${url}/ws?token=t`);
    const t0 = Date.now();
    const code = await new Promise<number>((resolve) => ws.on('close', (c) => resolve(c)));
    expect(code).toBe(4001);
    expect(Date.now() - t0).toBeLessThan(3000);
  });
});
