import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import type { WebSocket as NodeWs } from 'ws';
import type { Bytes } from '../../shared/e2e/bytes';
import type { KeyPair } from '../../shared/e2e/channel';

const mem: { pair?: KeyPair; pins: Bytes[] } = { pins: [] };
vi.mock('./device-store', async () => {
  const { publicRaw } = await import('../../shared/e2e/channel');
  return {
    deviceKeys: async () => {
      mem.pair ??= await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']) as unknown as KeyPair;
      return { pub: await publicRaw(mem.pair.publicKey), sign: mem.pair.privateKey };
    },
    pinnedAgents: async () => mem.pins,
    pinAgent: async (p: Bytes) => { mem.pins.push(p); },
  };
});

const { SealedSocket, enrollThisDevice, sealState } = await import('./sealed-socket');
const { SealedHub, agentKeysFrom } = await import('../../server/e2e/hub');
const { createEnrollCode } = await import('../../server/e2e/devices');

const C = 'CCCCCCCCCCCCCCCCCCCCCC';
const flush = () => new Promise((r) => setTimeout(r, 40));

// Plays the relay: stamps the tab id on browser frames, strips it on the way
// back, and lets a test inject or tamper with frames like a hostile relay would.
class Relay {
  browser: FakeBrowserWs | null = null;
  toBrowserLog: string[] = [];
  agentLink = { OPEN: 1, readyState: 1, bufferedAmount: 0, send: (s: string) => this.fromAgent(s) } as unknown as NodeWs;
  hub!: InstanceType<typeof SealedHub>;
  served: string[] = [];

  fromAgent(s: string) {
    const m = /^\{"c":"([A-Za-z0-9_-]{22})"(?:,"p":([01]))?,/.exec(s);
    const out = m ? `{${s.slice(m[0].length)}` : s;
    this.toBrowserLog.push(out);
    this.browser?.receive(out);
  }

  fromBrowser(s: string) {
    if (s.startsWith('{"t":"e2e')) this.hub.handle(`${s.slice(0, -1)},"c":"${C}"}`);
  }
}

class FakeBrowserWs {
  static relay: Relay;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  bufferedAmount = 0;
  sent: string[] = [];
  constructor() {
    FakeBrowserWs.relay.browser = this;
    setTimeout(() => { this.readyState = 1; this.onopen?.(); this.receive('{"t":"agent-online"}'); }, 0);
  }
  send(s: string) { this.sent.push(s); FakeBrowserWs.relay.fromBrowser(s); }
  close(code = 1000, reason = '') { this.readyState = 3; this.onclose?.({ code, reason }); }
  receive(s: string) { this.onmessage?.({ data: s }); }
}
(FakeBrowserWs as unknown as { OPEN: number }).OPEN = 1;

let relay: Relay;

beforeEach(async () => {
  process.env.DECK_AGENT_DIR = mkdtempSync(join(tmpdir(), 'deck-sealed-'));
  mem.pair = undefined; mem.pins = [];
  relay = new Relay();
  FakeBrowserWs.relay = relay;
  vi.stubGlobal('WebSocket', FakeBrowserWs);
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const keys = await agentKeysFrom(privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
  relay.hub = new SealedHub({
    keys, link: relay.agentLink, onPeersChanged: () => {},
    serve: (peer) => peer.on('message', (b: Buffer) => { relay.served.push(b.toString()); peer.send(JSON.stringify({ t: 'pong', echo: b.toString() })); }),
  });
  (relay as unknown as { keys: typeof keys }).keys = keys;
});
afterEach(() => { vi.unstubAllGlobals(); });

async function enrolledSocket() {
  const s = new SealedSocket('wss://relay/ws');
  const got: string[] = [];
  let opened = false;
  s.onopen = () => { opened = true; };
  s.onmessage = (ev) => got.push(String(ev.data));
  await flush();
  expect(sealState.get()).toBe('enroll');
  const { code } = await createEnrollCode((relay as unknown as { keys: { pub: Bytes } }).keys.pub);
  await enrollThisDevice(code, 'test');
  await flush();
  return { s, got, isOpen: () => opened };
}

describe('SealedSocket against the real agent hub', () => {
  it('enrolls, seals and round-trips app frames', async () => {
    const { s, got, isOpen } = await enrolledSocket();
    expect(isOpen()).toBe(true);
    expect(sealState.get()).toBe('sealed');
    s.send('{"t":"list"}');
    await flush();
    expect(relay.served).toEqual(['{"t":"list"}']);
    expect(got).toContain(JSON.stringify({ t: 'pong', echo: '{"t":"list"}' }));
  });

  it('never puts app plaintext on the wire', async () => {
    const { s } = await enrolledSocket();
    s.send('{"t":"admin-env-set","name":"X","value":"sk-ant-secret"}');
    await flush();
    const wire = [...relay.browser!.sent, ...relay.toBrowserLog].join('\n');
    expect(wire).not.toContain('sk-ant-secret');
    expect(wire).not.toContain('admin-env-set');
  });

  it('drops plaintext app frames a hostile relay injects', async () => {
    const { got } = await enrolledSocket();
    relay.browser!.receive('{"t":"delta","sessionKey":"k","text":"click this link"}');
    relay.browser!.receive('{"t":"caps","caps":{"role":"root","canBypass":true}}');
    await flush();
    expect(got.some((g) => g.includes('click this link') || g.includes('canBypass'))).toBe(false);
  });

  it('refuses an agent key it never pinned (relay in the middle)', async () => {
    const { s } = await enrolledSocket();
    s.close();
    await flush();
    mem.pins = [new Uint8Array(32).fill(7)];
    const again = new SealedSocket('wss://relay/ws');
    let opened = false;
    again.onopen = () => { opened = true; };
    await flush(); await flush();
    expect(opened).toBe(false);
    expect(sealState.get()).toBe('rejected');
  });

  it('sends relay-owned admin frames in the clear and nothing else', async () => {
    const { s } = await enrolledSocket();
    s.send('{"t":"accounts-list"}');
    await flush();
    expect(relay.browser!.sent).toContain('{"t":"accounts-list"}');
  });
});
