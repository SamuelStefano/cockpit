import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { createRelay, maybeControlFrame, type RelayStore } from './src/index';

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
    // filtra por saw==='send': o agente também ecoa os frames de presença
    // (no-browsers no bind, browsers-present quando a 1ª aba conecta).
    const echo = await waitA((m) => m.t === 'echo' && m.saw === 'send');
    expect(echo.saw).toBe('send'); // frame do browser chegou no agente da conta A e voltou

    // Browser da conta B (sem agente): recebe agent-offline, NUNCA vê o eco de A.
    const browserB = new WebSocket(`${url}/ws?token=B1`); sockets.push(browserB);
    const waitB = collect(browserB);
    await waitB((m) => m.t === 'caps');
    const off = await waitB((m) => m.t === 'agent-offline');
    expect(off.t).toBe('agent-offline'); // conta B isolada, sem agente pareado
  });

  it('tells a newly-connected browser the agent is already online', async () => {
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
      resolveIdentity: async (tok) => tok?.startsWith('A') ? { accountId: 'accA', email: 'a@x', role: 'fellow' } : null,
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;

    const agentA = connectFakeAgent(url, 'ag-A', A.priv); sockets.push(agentA.ws);
    await agentA.ready; // agente já bindado ANTES da aba conectar

    const browserA = new WebSocket(`${url}/ws?token=A1`); sockets.push(browserA);
    const waitA = collect(browserA);
    // Sem este frame a aba ficava presa no pareamento (agentOnline inicia false).
    const online = await waitA((m) => m.t === 'agent-online');
    expect(online.t).toBe('agent-online');
  });

  it('routes a browser frame sent on open, before auth completes (no early-frame drop)', async () => {
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
      // Auth lenta de propósito: simula o RTT do JWKS. No código antigo o `list`
      // disparado no open chegava nessa janela e era descartado (sem listener).
      resolveIdentity: async (tok) => {
        await new Promise((r) => setTimeout(r, 60));
        return tok?.startsWith('A') ? { accountId: 'accA', email: 'a@x', role: 'fellow' } : null;
      },
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;

    const agentA = connectFakeAgent(url, 'ag-A', A.priv); sockets.push(agentA.ws);
    await agentA.ready;

    const browserA = new WebSocket(`${url}/ws?token=A1`); sockets.push(browserA);
    const waitA = collect(browserA);
    // Dispara `list` no open — exatamente como o cliente real faz — ANTES da auth.
    browserA.on('open', () => browserA.send(JSON.stringify({ t: 'list' })));
    const echo = await waitA((m) => m.t === 'echo' && m.saw === 'list');
    expect(echo.saw).toBe('list'); // o frame pré-auth chegou ao agente
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

  // Regressão: o pré-filtro de frame de admin é por SUBSTRING sobre o JSON cru.
  // Aspas dentro de texto saem escapadas (\"), então o gatilho não é "mencionar" o
  // nome: é qualquer CAMPO cujo valor seja exatamente `accounts-list`/`set-admin` —
  // digitar isso no chat basta. O frame batia no pré-filtro, não casava com nenhum
  // `t` de admin e era engolido em silêncio, sem nunca chegar ao agente.
  it('routes a chat frame whose text is exactly an admin frame name', async () => {
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
      resolveIdentity: async (tok) => tok?.startsWith('R') ? { accountId: 'accA', email: 'r@x', role: 'root' } : null,
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;

    const agentA = connectFakeAgent(url, 'ag-A', A.priv); sockets.push(agentA.ws);
    await agentA.ready;

    // Root de propósito: mesmo quem PODE administrar não pode ter o chat engolido.
    const browser = new WebSocket(`${url}/ws?token=R1`); sockets.push(browser);
    const wait = collect(browser);
    await wait((m) => m.t === 'caps');
    browser.send(JSON.stringify({ t: 'send', sessionKey: 'k', text: 'accounts-list' }));
    const echo = await wait((m) => m.t === 'echo' && m.saw === 'send');
    expect(echo.saw).toBe('send');
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

describe('maybeControlFrame (pré-filtro do JSON.parse)', () => {
  it('acerta o frame de controle real', () => {
    expect(maybeControlFrame(JSON.stringify({ t: 'accounts-list' }), 'accounts-list', 'set-admin')).toBe(true);
    expect(maybeControlFrame(JSON.stringify({ t: 'agent-caps', canBypass: true }), 'agent-caps')).toBe(true);
  });

  it('é só uma heurística: casa com o valor de qualquer campo, não só com o `t`', () => {
    // Por isso quem chama PRECISA conferir o `t` e deixar o frame seguir quando não bate.
    expect(maybeControlFrame(JSON.stringify({ t: 'send', text: 'accounts-list' }), 'accounts-list', 'set-admin')).toBe(true);
  });

  it('não casa com aspas escapadas dentro de texto', () => {
    expect(maybeControlFrame(JSON.stringify({ t: 'send', text: 'o "set-admin" faz o quê?' }), 'set-admin')).toBe(false);
  });

  it('descarta frame grande sem varrer a string (upload de 32MB não paga parse)', () => {
    expect(maybeControlFrame(`{"t":"upload","d":"${'A'.repeat(5000)}"}`, 'upload')).toBe(false);
  });
});

// Um store fora do ar (PostgREST caiu, rede piscou) rejeita as promises que os
// handlers de evento do relay disparam. Em Node isso vira unhandledRejection e mata
// o processo — no relay isso derruba TODA conta conectada, não só quem tropeçou.
describe('relay: falha do store nega o socket sem derrubar o processo', () => {
  let server: import('node:http').Server | null = null;
  const sockets: WebSocket[] = [];
  let rejections: unknown[] = [];
  const onRejection = (e: unknown) => { rejections.push(e); };

  beforeEach(() => { rejections = []; process.on('unhandledRejection', onRejection); });
  afterEach(() => {
    process.off('unhandledRejection', onRejection);
    sockets.forEach((s) => { try { s.close(); } catch {} }); sockets.length = 0;
    server?.close(); server = null;
  });

  // unhandledRejection só é emitido depois que a fila de microtasks drena.
  const settle = () => new Promise<void>((r) => setTimeout(r, 50));

  const brokenStore = (over: Partial<RelayStore> = {}): RelayStore => ({
    async agentById() { return null; }, async isAdmin() { return false; },
    async listAccounts() { return []; }, async setAdmin() { return true; },
    async markAgentSeen() {}, async createPairingCode() { return 'code-1'; },
    async consumePairingCode() { return null; }, async createAgent() { return null; },
    ...over,
  });

  async function listen(cfg: Parameters<typeof createRelay>[0]) {
    const relay = createRelay(cfg);
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const { port } = server!.address() as AddressInfo;
    return { ws: `ws://127.0.0.1:${port}`, http: `http://127.0.0.1:${port}` };
  }

  it('browser: resolver identidade explodiu → fecha 4401 (default-deny)', async () => {
    const url = await listen({
      iss: 't', jwksUrl: 'http://x', rootEmails: '', store: brokenStore(),
      resolveIdentity: async () => { throw new Error('PostgREST fora do ar'); },
    });
    const ws = new WebSocket(`${url.ws}/ws?token=A1`); sockets.push(ws);
    const code = await new Promise<number>((r) => ws.on('close', (c) => r(c)));
    expect(code).toBe(4401);          // erro NÃO vira acesso liberado
    await settle();
    expect(rejections).toEqual([]);
  });

  it('agente: agentById explodiu no handshake → fecha 4500, relay de pé', async () => {
    const A = makeAgentKeys();
    const url = await listen({
      iss: 't', jwksUrl: 'http://x', rootEmails: '',
      store: brokenStore({ async agentById() { throw new Error('PostgREST fora do ar'); } }),
      resolveIdentity: async () => ({ accountId: 'accA', email: 'a@x', role: 'fellow' }),
    });
    const agent = connectFakeAgent(url.ws, 'ag-A', A.priv); sockets.push(agent.ws);
    const code = await new Promise<number>((r) => agent.ws.on('close', (c) => r(c)));
    expect(code).toBe(4500);
    await settle();
    expect(rejections).toEqual([]);

    // O relay continua servindo: outra aba conecta e recebe caps normalmente.
    const ws = new WebSocket(`${url.ws}/ws?token=A1`); sockets.push(ws);
    const caps = await collect(ws)((m) => m.t === 'caps');
    expect(caps.t).toBe('caps');
  });

  it('browser: listAccounts explodiu → só não responde; o socket segue roteando', async () => {
    const A = makeAgentKeys();
    const url = await listen({
      iss: 't', jwksUrl: 'http://x', rootEmails: '',
      store: brokenStore({
        async agentById(id) { return id === 'ag-A' ? { accountId: 'accA', publicKey: A.pub } : null; },
        async listAccounts() { throw new Error('PostgREST fora do ar'); },
      }),
      resolveIdentity: async () => ({ accountId: 'accA', email: 'a@x', role: 'root' }),
    });
    const agent = connectFakeAgent(url.ws, 'ag-A', A.priv); sockets.push(agent.ws);
    await agent.ready;

    const ws = new WebSocket(`${url.ws}/ws?token=R1`); sockets.push(ws);
    const wait = collect(ws);
    await wait((m) => m.t === 'caps');
    ws.send(JSON.stringify({ t: 'accounts-list' }));
    await settle();
    expect(rejections).toEqual([]);
    expect(ws.readyState).toBe(WebSocket.OPEN);

    // Falha de um frame de administração não pode contaminar o chat.
    ws.send(JSON.stringify({ t: 'send', sessionKey: 'k', text: 'oi' }));
    const echo = await wait((m) => m.t === 'echo' && m.saw === 'send');
    expect(echo.saw).toBe('send');
  });
});

describe('POST /pair/new', () => {
  let server: import('node:http').Server | null = null;
  afterEach(() => { server?.close(); server = null; });

  const store: RelayStore = {
    async agentById() { return null; }, async isAdmin() { return false; },
    async listAccounts() { return []; }, async setAdmin() { return true; },
    async markAgentSeen() {}, async createPairingCode() { return 'code-1'; },
    async consumePairingCode() { return null; }, async createAgent() { return null; },
  };

  async function listen() {
    const relay = createRelay({
      iss: 't', jwksUrl: 'http://x', rootEmails: '', store,
      resolveIdentity: async (tok) => (tok === 'good' ? { accountId: 'accA', email: 'a@x', role: 'fellow' } : null),
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
  }

  const pair = (base: string, init?: RequestInit) => fetch(`${base}/pair/new`, { method: 'POST', ...init });

  it('emite o código com Bearer válido', async () => {
    const base = await listen();
    const res = await pair(base, { headers: { authorization: 'Bearer good' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: 'code-1' });
  });

  it('recusa o JWT em query string (token vaza no access log)', async () => {
    const base = await listen();
    const res = await fetch(`${base}/pair/new?token=good`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('barra a rajada: acima de 5 códigos por minuto responde 429', async () => {
    const base = await listen();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await pair(base, { headers: { authorization: 'Bearer good' } })).status);
    expect(codes).toEqual([200, 200, 200, 200, 200, 429, 429]);
  });
});
