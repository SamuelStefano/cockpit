import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { connect } from 'node:net';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createRelay, type RelayStore } from './index';

const store: RelayStore = {
  async agentById() { return null; }, async isAdmin() { return false; },
  async listAccounts() { return []; }, async setAdmin() { return true; },
  async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
  async consumePairingCode() { return null; }, async createAgent() { return null; },
};

let server: Server | null = null;
afterEach(() => { server?.close(); server = null; });

// A raw client that upgrades and then sends one UNMASKED text frame (clients must
// mask): ws emits 'error' on that socket, and with no listener Node throws it.
function sendUnmaskedFrame(port: number, path: string): Promise<void> {
  return new Promise((resolve) => {
    const c = connect(port, '127.0.0.1', () => {
      c.write(`GET ${path} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      setTimeout(() => { c.write(Buffer.from([0x81, 0x02, 0x68, 0x69])); }, 100);
      setTimeout(() => { c.destroy(); resolve(); }, 400);
    });
    c.on('error', () => resolve());
  });
}

describe('relay survives malformed frames', () => {
  it('a bad frame on /agent or /ws only drops that socket, not the relay', async () => {
    const relay = createRelay({ iss: 't', jwksUrl: 'http://x', rootEmails: '', store, resolveIdentity: async () => null });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const port = (server!.address() as AddressInfo).port;
    await sendUnmaskedFrame(port, '/agent');
    await sendUnmaskedFrame(port, '/ws');
    // Still serving: a fresh client can open a socket.
    const ws = new WebSocket(`ws://127.0.0.1:${port}/agent`);
    await new Promise<void>((resolve, reject) => { ws.on('open', () => resolve()); ws.on('error', reject); });
    ws.close();
    expect(true).toBe(true);
  });
});
