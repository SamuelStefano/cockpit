import { describe, it, expect, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { createRelay, type RelayStore } from './src/index';

// Integração do relay ponta-a-ponta SEM claude: relay real + um "agente" que faz o
// handshake Ed25519 de verdade e ecoa + um "browser". Prova roteamento por conta,
// pareamento por challenge e isolamento entre contas — o caminho que o harness
// manual exercitou com um turno real. Determinístico, sem rede externa.

// Coletor com buffer: guarda TODOS os frames e o waitFor varre o buffer + espera —
// sem perder frames que chegam entre awaits (race de listener).
function collect(ws: WebSocket) {
  const buf: any[] = [];
  const waiters: { pred: (m: any) => boolean; resolve: (m: any) => void }[] = [];
  ws.on('message', (raw) => {
    let m: any; try { m = JSON.parse(raw.toString()); } catch { return; }
    buf.push(m);
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].pred(m)) { waiters[i].resolve(m); waiters.splice(i, 1); }
    }
  });
  return (pred: (m: any) => boolean, ms = 4000) => {
    const hit = buf.find(pred);
    if (hit) return Promise.resolve(hit);
    return new Promise<any>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('timeout waiting frame')), ms);
      waiters.push({ pred, resolve: (m) => { clearTimeout(to); resolve(m); } });
    });
  };
}

function makeAgentKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), priv: privateKey };
}

// Liga um "agente" no relay: handshake real (hello→challenge→assina→ready) e ecoa
// cada frame recebido de volta. `ready` resolve quando o relay manda agent-ready.
function connectFakeAgent(url: string, agentId: string, priv: import('node:crypto').KeyObject) {
  const ws = new WebSocket(`${url}/agent`);
  let resolveReady: () => void;
  const ready = new Promise<void>((r) => { resolveReady = r; });
  ws.on('open', () => ws.send(JSON.stringify({ t: 'agent-hello', agentId })));
  ws.on('message', (raw) => {
    let m: any; try { m = JSON.parse(raw.toString()); } catch { return; }
    if (m.t === 'challenge') {
      const sig = edSign(null, Buffer.from(`${m.nonce}.${agentId}`), priv).toString('base64');
      ws.send(JSON.stringify({ t: 'agent-auth', sig }));
    } else if (m.t === 'agent-ready') {
      resolveReady();
    } else {
      ws.send(JSON.stringify({ t: 'echo', saw: m.t })); // ecoa o que o browser mandou
    }
  });
  return { ws, ready };
}

describe('relay integration (browser ↔ agent, per-account)', () => {
  let server: import('node:http').Server | null = null;
  const sockets: WebSocket[] = [];
  afterEach(() => { sockets.forEach((s) => { try { s.close(); } catch {} }); sockets.length = 0; server?.close(); server = null; });

  it('routes a browser frame to that account agent and echoes back, isolated per account', async () => {
    const A = makeAgentKeys();
    const store: RelayStore = {
      async agentById(id) { return id === 'ag-A' ? { accountId: 'accA', publicKey: A.pub } : null; },
      async isAdmin() { return false; },
      async listAccounts() { return []; }, async setAdmin() { return true; },
      async markAgentSeen() {}, async createPairingCode() { return 'x'; },
      async consumePairingCode() { return null; }, async createAgent() { return null; },
    };
    const relay = createRelay({
      iss: 't', jwksUrl: 'http://x', rootEmails: '', store,
      // identidade stub: token "A:*" → conta A, "B:*" → conta B.
      resolveIdentity: async (tok) => tok?.startsWith('A') ? { accountId: 'accA', email: 'a@x', role: 'fellow' }
        : tok?.startsWith('B') ? { accountId: 'accB', email: 'b@x', role: 'fellow' } : null,
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;

    const agentA = connectFakeAgent(url, 'ag-A', A.priv); sockets.push(agentA.ws);
    await agentA.ready; // handshake Ed25519 completo, agente bindado

    // Browser da conta A (agente já online): caps, sem agent-offline; manda → eco.
    const browserA = new WebSocket(`${url}/ws?token=A1`); sockets.push(browserA);
    const waitA = collect(browserA);
    await waitA((m) => m.t === 'caps');
    browserA.send(JSON.stringify({ t: 'send', text: 'oi', sessionKey: 'k' }));
    const echo = await waitA((m) => m.t === 'echo');
    expect(echo.saw).toBe('send'); // frame do browser chegou no agente da conta A e voltou

    // Browser da conta B (sem agente): recebe agent-offline, NUNCA vê o eco de A.
    const browserB = new WebSocket(`${url}/ws?token=B1`); sockets.push(browserB);
    const waitB = collect(browserB);
    await waitB((m) => m.t === 'caps');
    const off = await waitB((m) => m.t === 'agent-offline');
    expect(off.t).toBe('agent-offline'); // conta B isolada, sem agente pareado
  });

  it('gates account admin frames by role (root toggles, fellow denied)', async () => {
    const setCalls: Array<{ id: string; admin: boolean }> = [];
    const rows = [
      { id: 'accA', email: 'a@x', isAdmin: false },
      { id: 'accB', email: 'b@x', isAdmin: true },
    ];
    const store: RelayStore = {
      async agentById() { return null; }, async isAdmin() { return false; },
      async listAccounts() { return rows.map((r) => ({ ...r })); },
      async setAdmin(id, admin) { setCalls.push({ id, admin }); const r = rows.find((x) => x.id === id); if (r) r.isAdmin = admin; return true; },
      async markAgentSeen() {}, async createPairingCode() { return 'x'; },
      async consumePairingCode() { return null; }, async createAgent() { return null; },
    };
    const relay = createRelay({
      iss: 't', jwksUrl: 'http://x', rootEmails: '', store,
      resolveIdentity: async (tok) => tok?.startsWith('R') ? { accountId: 'accR', email: 'r@x', role: 'root' }
        : tok?.startsWith('F') ? { accountId: 'accF', email: 'f@x', role: 'fellow' } : null,
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;

    // Root: lista contas e alterna admin (recebe a lista de volta).
    const root = new WebSocket(`${url}/ws?token=R1`); sockets.push(root);
    const waitR = collect(root);
    await waitR((m) => m.t === 'caps');
    root.send(JSON.stringify({ t: 'accounts-list' }));
    const list = await waitR((m) => m.t === 'accounts');
    expect(list.accounts).toHaveLength(2);
    root.send(JSON.stringify({ t: 'set-admin', accountId: 'accA', admin: true }));
    await waitR((m) => m.t === 'accounts' && m.accounts.some((a: { id: string; isAdmin: boolean }) => a.id === 'accA' && a.isAdmin));
    expect(setCalls).toEqual([{ id: 'accA', admin: true }]);

    // Fellow: accounts-list não responde, set-admin não chama o store.
    const fellow = new WebSocket(`${url}/ws?token=F1`); sockets.push(fellow);
    const waitF = collect(fellow);
    await waitF((m) => m.t === 'caps');
    fellow.send(JSON.stringify({ t: 'set-admin', accountId: 'accB', admin: false }));
    fellow.send(JSON.stringify({ t: 'accounts-list' }));
    await expect(waitF((m) => m.t === 'accounts', 600)).rejects.toThrow();
    expect(setCalls).toEqual([{ id: 'accA', admin: true }]); // fellow não escreveu nada
  });

  it('rejects a browser with no/invalid identity (default-deny)', async () => {
    const store: RelayStore = {
      async agentById() { return null; }, async isAdmin() { return false; },
      async listAccounts() { return []; }, async setAdmin() { return true; },
      async markAgentSeen() {}, async createPairingCode() { return 'x'; },
      async consumePairingCode() { return null; }, async createAgent() { return null; },
    };
    const relay = createRelay({ iss: 't', jwksUrl: 'http://x', rootEmails: '', store, resolveIdentity: async () => null });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;
    const ws = new WebSocket(`${url}/ws?token=whatever`); sockets.push(ws);
    const code = await new Promise<number>((resolve) => ws.on('close', (c) => resolve(c)));
    expect(code).toBe(4401); // default-deny
  });
});
