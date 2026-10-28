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

const B1 = '11111111-1111-4111-8111-111111111111';
const B2 = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '33333333-3333-4333-8333-333333333333';

// Collects every JSON frame a socket receives; `next` waits for one matching.
function inbox(ws: WebSocket) {
  const got: Array<Record<string, unknown>> = [];
  const waiters: Array<{ pred: (m: Record<string, unknown>) => boolean; resolve: (m: Record<string, unknown>) => void }> = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    got.push(m);
    for (const w of [...waiters]) if (w.pred(m)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(m); }
  });
  const next = (pred: (m: Record<string, unknown>) => boolean) => new Promise<Record<string, unknown>>((resolve) => {
    const hit = got.find(pred);
    if (hit) resolve(hit); else waiters.push({ pred, resolve });
  });
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
  return { got, next, closed };
}

describe('several boxes paired to one account', () => {
  let server: import('node:http').Server | null = null;
  const socks: WebSocket[] = [];
  afterEach(() => { socks.forEach((s) => { try { s.close(); } catch {} }); socks.length = 0; server?.close(); server = null; });

  async function relayWith(agents: Record<string, string>, over: Partial<RelayStore> = {}) {
    const calls: string[] = [];
    const store: RelayStore = {
      async agentById(id) { return agents[id] ? { accountId: 'acc', publicKey: agents[id], pairedAt: id === B1 ? '2026-01-01T00:00:00Z' : '2026-06-01T00:00:00Z' } : null; },
      async isAdmin() { return false; }, async listAccounts() { return []; }, async setAdmin() { return true; },
      async markAgentSeen() {}, async createPairingCode() { return { code: 'x', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
      async consumePairingCode() { return null; }, async createAgent() { return null; },
      async listBoxes() { return Object.keys(agents).map((id) => ({ id, label: `box ${id.slice(0, 1)}`, lastSeen: null })); },
      async renameBox(acc, id, label) { calls.push(`rename ${acc} ${id} ${label}`); return id in agents; },
      async revokeBox(acc, id) { calls.push(`revoke ${acc} ${id}`); if (!(id in agents)) return false; delete agents[id]; return true; },
      ...over,
    };
    const relay = createRelay({
      iss: 't', jwksUrl: 'http://x', rootEmails: '', store, maxBoxesPerAccount: 2,
      resolveIdentity: async (tok) => (tok === 'me' ? { accountId: 'acc', email: 'a@x', role: 'fellow' } : null),
    });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    return { url: `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`, calls };
  }

  function tab(url: string, box?: string) {
    const ws = new WebSocket(`${url}/ws?token=me${box ? `&box=${box}` : ''}`);
    socks.push(ws);
    return { ws, ...inbox(ws) };
  }

  async function twoBoxes() {
    const A = keys(); const B = keys();
    const env = await relayWith({ [B1]: A.pub, [B2]: B.pub });
    const first = agent(env.url, B1, A.priv); socks.push(first.ws);
    expect(await first.outcome).toBe('ready');
    const second = agent(env.url, B2, B.priv); socks.push(second.ws);
    expect(await second.outcome).toBe('ready');
    return { ...env, first, second };
  }

  it('tells the tab an agent without the sealed channel is plain, and a sealed one is not', async () => {
    const { url, first, second } = await twoBoxes();
    first.ws.send(JSON.stringify({ t: 'agent-caps', canBypass: false }));
    second.ws.send(JSON.stringify({ t: 'agent-caps', canBypass: false, sealed: true }));
    await new Promise((r) => setTimeout(r, 50));
    const t1 = tab(url, B1), t2 = tab(url, B2);
    expect((await t1.next((m) => m.t === 'agent-online')).plain).toBe(true);
    expect((await t2.next((m) => m.t === 'agent-online')).plain).toBeUndefined();
  });

  it('a tab already open hears plain when the agent reports its caps', async () => {
    const { url, first } = await twoBoxes();
    const t1 = tab(url, B1);
    await t1.next((m) => m.t === 'agent-online');
    first.ws.send(JSON.stringify({ t: 'agent-caps', canBypass: false }));
    expect((await t1.next((m) => m.t === 'agent-online' && m.plain === true)).box).toBe(B1);
  });

  it('a second box comes online next to the first instead of being refused', async () => {
    const { first, second } = await twoBoxes();
    expect(first.ws.readyState).toBe(WebSocket.OPEN);
    expect(second.ws.readyState).toBe(WebSocket.OPEN);
  });

  it('each tab talks only to its own box; a tab with no box talks to the primary', async () => {
    const { url, first, second } = await twoBoxes();
    const in1 = inbox(first.ws), in2 = inbox(second.ws);
    const t2 = tab(url, B2), t0 = tab(url);
    expect((await t2.next((m) => m.t === 'agent-online')).box).toBe(B2);
    expect((await t0.next((m) => m.t === 'agent-online')).box).toBe(B1);
    t2.ws.send(JSON.stringify({ t: 'list', n: 2 }));
    t0.ws.send(JSON.stringify({ t: 'list', n: 0 }));
    expect((await in2.next((m) => m.t === 'list')).n).toBe(2);
    expect((await in1.next((m) => m.t === 'list')).n).toBe(0);
    second.ws.send(JSON.stringify({ t: 'sessions', from: 2 }));
    first.ws.send(JSON.stringify({ t: 'sessions', from: 1 }));
    expect((await t2.next((m) => m.t === 'sessions')).from).toBe(2);
    expect((await t0.next((m) => m.t === 'sessions')).from).toBe(1);
    await new Promise((r) => setTimeout(r, 100));
    expect(t2.got.filter((m) => m.t === 'sessions')).toHaveLength(1);
    expect(t0.got.filter((m) => m.t === 'sessions')).toHaveLength(1);
    expect(in1.got.some((m) => m.n === 2)).toBe(false);
  });

  it('tells each tab the account boxes and which one it is on', async () => {
    const { url } = await twoBoxes();
    const t = tab(url, B2);
    const f = await t.next((m) => m.t === 'boxes');
    expect(f.box).toBe(B2);
    expect(f.primary).toBe(B1);
    expect(f.boxes).toEqual([
      { id: B1, label: 'box 1', online: true, lastSeen: null },
      { id: B2, label: 'box 2', online: true, lastSeen: null },
    ]);
  });

  it('a box of another account looks offline and gets nothing', async () => {
    const { url, first, second } = await twoBoxes();
    const in1 = inbox(first.ws), in2 = inbox(second.ws);
    const t = tab(url, FOREIGN);
    expect((await t.next((m) => m.t === 'agent-offline')).box).toBe(FOREIGN);
    t.ws.send(JSON.stringify({ t: 'list' }));
    expect((await t.next((m) => m.t === 'agent-offline' && t.got.length > 3)).t).toBe('agent-offline');
    expect(in1.got.some((m) => m.t === 'list') || in2.got.some((m) => m.t === 'list')).toBe(false);
  });

  it('refuses a box parameter that is not a uuid', async () => {
    const { url } = await relayWith({});
    const t = tab(url, 'ag-1');
    expect(await t.closed).toBe(4400);
  });

  it('revoking one box cuts only that box, scoped to the caller account', async () => {
    const { url, first, second, calls } = await twoBoxes();
    const t1 = tab(url, B1), t2 = tab(url, B2);
    await t1.next((m) => m.t === 'boxes'); await t2.next((m) => m.t === 'boxes');
    const secondClosed = new Promise((r) => second.ws.on('close', r));
    t1.ws.send(JSON.stringify({ t: 'box-revoke', id: B2 }));
    await secondClosed;
    expect((await t2.next((m) => m.t === 'agent-offline')).box).toBe(B2);
    expect(calls).toEqual([`revoke acc ${B2}`]);
    await new Promise((r) => setTimeout(r, 100));
    expect(first.ws.readyState).toBe(WebSocket.OPEN);
    expect(t1.got.some((m) => m.t === 'agent-offline')).toBe(false);
  });

  it('rename sends a sanitized label and the account from the JWT, never forwarded to a box', async () => {
    const { url, first, calls } = await twoBoxes();
    const in1 = inbox(first.ws);
    const t = tab(url, B1);
    await t.next((m) => m.t === 'boxes');
    t.ws.send(JSON.stringify({ t: 'box-rename', id: B1, label: ' pc\u202e casa ', accountId: 'other' }));
    t.ws.send(JSON.stringify({ t: 'box-rename', id: 'not-a-uuid', label: 'x' }));
    await new Promise((r) => setTimeout(r, 150));
    expect(calls).toEqual([`rename acc ${B1} pc casa`]);
    expect(in1.got.some((m) => String(m.t).startsWith('box-'))).toBe(false);
  });

  it('tabs following the primary redial when it goes away and another box takes over', async () => {
    const { url, first } = await twoBoxes();
    const t0 = tab(url), t1 = tab(url, B1);
    await t0.next((m) => m.t === 'agent-online'); await t1.next((m) => m.t === 'agent-online');
    first.ws.terminate();
    expect(await t0.closed).toBe(4003);
    expect((await t1.next((m) => m.t === 'agent-offline')).box).toBe(B1);
  });

  it('presence is per box: only the watched box hears browsers-present', async () => {
    const { url, first, second } = await twoBoxes();
    const in1 = inbox(first.ws), in2 = inbox(second.ws);
    const t = tab(url, B2);
    await t.next((m) => m.t === 'agent-online');
    await in2.next((m) => m.t === 'browsers-present');
    await new Promise((r) => setTimeout(r, 100));
    expect(in1.got.some((m) => m.t === 'browsers-present')).toBe(false);
    t.ws.close();
    await in2.next((m) => m.t === 'no-browsers');
  });

  it('the earliest-paired box stays primary even when it connects last', async () => {
    const A = keys(); const B = keys();
    const { url } = await relayWith({ [B1]: A.pub, [B2]: B.pub });
    const late = agent(url, B2, B.priv); socks.push(late.ws);
    expect(await late.outcome).toBe('ready');
    const early = agent(url, B1, A.priv); socks.push(early.ws);
    expect(await early.outcome).toBe('ready');
    const t = tab(url);
    expect((await t.next((m) => m.t === 'boxes')).primary).toBe(B1);
  });

  it('tabs following the primary redial when the earlier-paired box comes back', async () => {
    const A = keys(); const B = keys();
    const { url } = await relayWith({ [B1]: A.pub, [B2]: B.pub });
    const late = agent(url, B2, B.priv); socks.push(late.ws);
    expect(await late.outcome).toBe('ready');
    const t0 = tab(url), t2 = tab(url, B2);
    expect((await t0.next((m) => m.t === 'agent-online')).box).toBe(B2);
    await t2.next((m) => m.t === 'agent-online');
    const lateIn = inbox(late.ws);
    t0.ws.send(JSON.stringify({ t: 'e2e', x: 1 }));
    const sealed = await lateIn.next((m) => m.t === 'e2e');
    const early = agent(url, B1, A.priv); socks.push(early.ws);
    expect(await early.outcome).toBe('ready');
    expect(await t0.closed).toBe(4003);
    expect((await lateIn.next((m) => m.t === 'e2e-gone')).c).toBe(sealed.c);
    await new Promise((r) => setTimeout(r, 100));
    expect(t2.ws.readyState).toBe(WebSocket.OPEN);
  });

  it('a failed rename or revoke answers box-error to the requester', async () => {
    const { url } = await twoBoxes();
    const t = tab(url, B1);
    await t.next((m) => m.t === 'boxes');
    t.ws.send(JSON.stringify({ t: 'box-revoke', id: FOREIGN }));
    expect(await t.next((m) => m.t === 'box-error')).toEqual({ t: 'box-error', op: 'box-revoke', id: FOREIGN });
  });

  it('a peek needs a box, and does not count as someone looking at it', async () => {
    const { url, second } = await twoBoxes();
    const in2 = inbox(second.ws);
    const bad = new WebSocket(`${url}/ws?token=me&peek=1`); socks.push(bad);
    expect(await inbox(bad).closed).toBe(4400);
    const p = new WebSocket(`${url}/ws?token=me&box=${B2}&peek=1`); socks.push(p);
    const pin = inbox(p);
    await pin.next((m) => m.t === 'agent-online');
    second.ws.send(JSON.stringify({ t: 'sessions' }));
    await pin.next((m) => m.t === 'sessions');
    expect(in2.got.some((m) => m.t === 'browsers-present')).toBe(false);
  });

  it('the same agent reconnecting still takes over its half-open socket', async () => {
    const A = keys();
    const { url } = await relayWith({ [B1]: A.pub });
    const old = agent(url, B1, A.priv); socks.push(old.ws);
    expect(await old.outcome).toBe('ready');
    const again = agent(url, B1, A.priv); socks.push(again.ws);
    expect(await again.outcome).toBe('ready');
  });

  it('pairing past the box cap is refused before creating the agent', async () => {
    let created = 0;
    const { url } = await relayWith({ [B1]: 'k1', [B2]: 'k2' }, {
      async consumePairingCode() { return 'acc'; },
      async createAgent() { created++; return FOREIGN; },
    });
    const ws = new WebSocket(`${url}/agent`); socks.push(ws);
    const code = new Promise<number>((r) => ws.on('close', (c) => r(c)));
    ws.on('open', () => ws.send(JSON.stringify({ t: 'pair', code: 'abc', publicKey: keys().pub })));
    expect(await code).toBe(4429);
    expect(created).toBe(0);
  });
});

describe('agent login with a slow DB', () => {
  let server: import('node:http').Server | null = null;
  afterEach(() => { server?.close(); server = null; });

  it('sends agent-ready before stamping last-seen', async () => {
    const A = keys();
    let seenDone = false;
    const store: RelayStore = {
      async agentById(id) { return id === 'ag-1' ? { accountId: 'acc', publicKey: A.pub } : null; },
      async isAdmin() { return false; }, async listAccounts() { return []; }, async setAdmin() { return true; },
      async markAgentSeen() { await new Promise((r) => setTimeout(r, 1500)); seenDone = true; },
      async createPairingCode() { return { code: 'x', expiresAt: new Date(Date.now() + 600_000).toISOString() }; },
      async consumePairingCode() { return null; }, async createAgent() { return null; },
      async listBoxes() { return []; }, async renameBox() { return false; }, async revokeBox() { return false; },
    };
    const relay = createRelay({ iss: 't', jwksUrl: 'http://x', rootEmails: '', store, resolveIdentity: async () => null });
    server = relay.server;
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    const url = `ws://127.0.0.1:${(server!.address() as AddressInfo).port}`;
    const a = agent(url, 'ag-1', A.priv);
    expect(await a.outcome).toBe('ready');
    expect(seenDone).toBe(false);
    a.ws.close();
  });
});
