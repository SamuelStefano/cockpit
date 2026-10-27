import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { createRelay, type RelayStore } from './src/index';

function keys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), priv: privateKey };
}

function inbox(ws: WebSocket) {
  const raw: string[] = [];
  ws.on('message', (d) => raw.push(d.toString()));
  return raw;
}

const until = async (pred: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!pred()) { if (Date.now() > end) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 10)); }
};

function agent(url: string, agentId: string, priv: import('node:crypto').KeyObject) {
  const ws = new WebSocket(`${url}/agent`);
  const got = inbox(ws);
  let ready = false;
  ws.on('open', () => ws.send(JSON.stringify({ t: 'agent-hello', agentId })));
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.t === 'challenge') ws.send(JSON.stringify({ t: 'agent-auth', sig: edSign(null, Buffer.from(`${m.nonce}.${agentId}`), priv).toString('base64') }));
    if (m.t === 'agent-ready') ready = true;
  });
  return { ws, got, isReady: () => ready };
}

describe('relay sealed routing (T5)', () => {
  let server: import('node:http').Server | null = null;
  const socks: WebSocket[] = [];
  afterEach(() => { socks.forEach((s) => { try { s.close(); } catch { /* */ } }); socks.length = 0; server?.close(); server = null; });

  async function start() {
    const A = keys(), B = keys();
    const store: RelayStore = {
      async agentById(id) { return id === 'ag-A' ? { accountId: 'accA', publicKey: A.pub } : id === 'ag-B' ? { accountId: 'accB', publicKey: B.pub } : null; },
      async isAdmin() { return false; }, async listAccounts() { return []; }, async setAdmin() { return true; },
      async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: '' }; },
      async consumePairingCode() { return null; }, async createAgent() { return null; },
      async listBoxes() { return []; }, async renameBox() { return false; }, async revokeBox() { return false; },
    };
    const relay = createRelay({
      iss: 't', jwksUrl: 'http://x', rootEmails: '', store,
      resolveIdentity: async (tok) => tok?.startsWith('A') ? { accountId: 'accA', email: 'a@x', role: 'fellow' }
        : tok?.startsWith('B') ? { accountId: 'accB', email: 'b@x', role: 'fellow' } : null,
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;
    const agA = agent(url, 'ag-A', A.priv); socks.push(agA.ws);
    const agB = agent(url, 'ag-B', B.priv); socks.push(agB.ws);
    await until(() => agA.isReady() && agB.isReady());
    const tab = (tok: string) => {
      const ws = new WebSocket(`${url}/ws?token=${tok}`); socks.push(ws);
      return { ws, got: inbox(ws) };
    };
    return { agA, agB, tab };
  }

  const sealedFromAgent = (got: string[]) => got.map((s) => JSON.parse(s)).filter((m) => m.t?.startsWith('e2e'));

  it('stamps the tab id last, so a browser cannot pick another channel', async () => {
    const { agA, tab } = await start();
    const t1 = tab('A1');
    await until(() => t1.got.length > 0);
    t1.ws.send('{"t":"e2e-hello","c":"ZZZZZZZZZZZZZZZZZZZZZZ","dev":"x"}');
    await until(() => agA.got.some((s) => s.includes('e2e-hello')));
    const m = JSON.parse(agA.got.find((s) => s.includes('e2e-hello'))!);
    expect(m.c).not.toBe('ZZZZZZZZZZZZZZZZZZZZZZ');
    expect(m.c).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('delivers a sealed frame only to the addressed tab, without the routing id', async () => {
    const { agA, tab } = await start();
    const t1 = tab('A1'), t2 = tab('A2');
    await until(() => t1.got.length > 0 && t2.got.length > 0);
    t1.ws.send('{"t":"e2e-hello"}');
    await until(() => agA.got.some((s) => s.includes('e2e-hello')));
    const c = JSON.parse(agA.got.find((s) => s.includes('e2e-hello'))!).c;
    agA.ws.send(`{"c":"${c}","p":0,"t":"e2e","s":1,"d":"QUJD"}`);
    await until(() => sealedFromAgent(t1.got).length > 0);
    expect(sealedFromAgent(t1.got)[0]).toEqual({ t: 'e2e', s: 1, d: 'QUJD' });
    await new Promise((r) => setTimeout(r, 50));
    expect(sealedFromAgent(t2.got)).toHaveLength(0);
  });

  it('never lets an agent address a tab of another account', async () => {
    const { agA, agB, tab } = await start();
    const t1 = tab('A1');
    await until(() => t1.got.length > 0);
    t1.ws.send('{"t":"e2e-hello"}');
    await until(() => agA.got.some((s) => s.includes('e2e-hello')));
    const c = JSON.parse(agA.got.find((s) => s.includes('e2e-hello'))!).c;
    agB.ws.send(`{"c":"${c}","p":0,"t":"e2e","s":1,"d":"RVZJTA=="}`);
    await new Promise((r) => setTimeout(r, 80));
    expect(sealedFromAgent(t1.got)).toHaveLength(0);
  });

  it('tells the agent when a tab goes away', async () => {
    const { agA, tab } = await start();
    const t1 = tab('A1');
    await until(() => t1.got.length > 0);
    t1.ws.send('{"t":"e2e-hello"}');
    await until(() => agA.got.some((s) => s.includes('e2e-hello')));
    const c = JSON.parse(agA.got.find((s) => s.includes('e2e-hello'))!).c;
    t1.ws.close();
    await until(() => agA.got.some((s) => s === JSON.stringify({ t: 'e2e-gone', c })));
  });
});
