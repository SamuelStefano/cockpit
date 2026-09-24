import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { createRelay, type RelayStore } from './index';

let server: Server | null = null;
afterEach(() => { server?.close(); server = null; });

describe('relay agent handshake', () => {
  it('refuses a second agent-hello on the same socket (no rebinding to another account)', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    const store: RelayStore = {
      async agentById(id) {
        if (id === 'ag-A') return { accountId: 'accA', publicKey: pub };
        if (id === 'ag-B') { await new Promise((r) => setTimeout(r, 50)); return { accountId: 'accB', publicKey: 'irrelevant' }; }
        return null;
      },
      async isAdmin() { return false; }, async listAccounts() { return []; }, async setAdmin() { return true; },
      async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
      async consumePairingCode() { return null; }, async createAgent() { return null; },
    };
    const relay = createRelay({ iss: 't', jwksUrl: 'http://x', rootEmails: '', store, resolveIdentity: async () => null });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const ws = new WebSocket(`ws://127.0.0.1:${(server!.address() as AddressInfo).port}/agent`);
    const closed = new Promise<{ code: number; reason: string }>((resolve) => ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() })));
    ws.on('open', () => ws.send(JSON.stringify({ t: 'agent-hello', agentId: 'ag-A' })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.t === 'challenge') {
        // The race: a hello for another account's agent, then our own valid auth.
        ws.send(JSON.stringify({ t: 'agent-hello', agentId: 'ag-B' }));
        ws.send(JSON.stringify({ t: 'agent-auth', sig: edSign(null, Buffer.from(`${m.nonce}.ag-A`), privateKey).toString('base64') }));
      }
    });
    const c = await closed;
    expect(c).toEqual({ code: 4401, reason: 'hello twice' });
  });
});
