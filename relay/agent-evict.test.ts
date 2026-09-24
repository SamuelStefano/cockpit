import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { createRelay, type RelayStore } from './src/index';

function keys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), priv: privateKey };
}

// Real Ed25519 handshake; resolves with 'ready' or the close code.
function agent(url: string, agentId: string, priv: import('node:crypto').KeyObject) {
  const ws = new WebSocket(`${url}/agent`);
  const outcome = new Promise<'ready' | number>((resolve) => {
    ws.on('open', () => ws.send(JSON.stringify({ t: 'agent-hello', agentId })));
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.t === 'challenge') ws.send(JSON.stringify({ t: 'agent-auth', sig: edSign(null, Buffer.from(`${m.nonce}.${agentId}`), priv).toString('base64') }));
      else if (m.t === 'agent-ready') resolve('ready');
    });
    ws.on('close', (code) => resolve(code));
  });
  return { ws, outcome };
}

describe('two agents paired to one account', () => {
  let server: import('node:http').Server | null = null;
  const socks: WebSocket[] = [];
  afterEach(() => { socks.forEach((s) => { try { s.close(); } catch {} }); socks.length = 0; server?.close(); server = null; });

  async function relayWith(agents: Record<string, string>) {
    const store: RelayStore = {
      async agentById(id) { return agents[id] ? { accountId: 'acc', publicKey: agents[id] } : null; },
      async isAdmin() { return false; }, async listAccounts() { return []; }, async setAdmin() { return true; },
      async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
      async consumePairingCode() { return null; }, async createAgent() { return null; },
    };
    const relay = createRelay({ iss: 't', jwksUrl: 'http://x', rootEmails: '', store, resolveIdentity: async () => null });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    return `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  }

  it('a second, different agent is refused with 4409 instead of evicting the online one', async () => {
    const A = keys(); const B = keys();
    const url = await relayWith({ 'ag-1': A.pub, 'ag-2': B.pub });
    const first = agent(url, 'ag-1', A.priv); socks.push(first.ws);
    expect(await first.outcome).toBe('ready');
    const second = agent(url, 'ag-2', B.priv); socks.push(second.ws);
    expect(await second.outcome).toBe(4409);
    expect(first.ws.readyState).toBe(WebSocket.OPEN);
  });

  it('a bound agent revoked since its login does not keep the slot', async () => {
    const A = keys(); const B = keys();
    const agents: Record<string, string> = { 'ag-1': A.pub, 'ag-2': B.pub };
    const url = await relayWith(agents);
    const first = agent(url, 'ag-1', A.priv); socks.push(first.ws);
    expect(await first.outcome).toBe('ready');
    delete agents['ag-1']; // revoked in the store (agentById → null)
    const second = agent(url, 'ag-2', B.priv); socks.push(second.ws);
    expect(await second.outcome).toBe('ready');
  });

  it('the same agent reconnecting still takes over its half-open socket', async () => {
    const A = keys();
    const url = await relayWith({ 'ag-1': A.pub });
    const old = agent(url, 'ag-1', A.priv); socks.push(old.ws);
    expect(await old.outcome).toBe('ready');
    const again = agent(url, 'ag-1', A.priv); socks.push(again.ws);
    expect(await again.outcome).toBe('ready');
  });
});
