import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import type { WebSocket as NodeWs } from 'ws';
import type { Bytes } from '../../shared/e2e/bytes';
import type { KeyPair } from '../../shared/e2e/channel';
import type { PasskeyDevice } from '../../shared/e2e/passkey';

const mem: {
  pair?: KeyPair; pins: Bytes[]; boxPins: Record<string, Bytes[]>;
  passkey?: PasskeyDevice; preauth?: Bytes;
} = { pins: [], boxPins: {} };
vi.mock('./device-store', async () => {
  const { publicRaw } = await import('../../shared/e2e/channel');
  return {
    deviceKeys: async () => {
      if (mem.passkey) return { pub: mem.passkey.pub, sign: mem.passkey.pair.privateKey };
      mem.pair ??= await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']) as unknown as KeyPair;
      return { pub: await publicRaw(mem.pair.publicKey), sign: mem.pair.privateKey };
    },
    passkeyDevice: async () => (mem.passkey ? { pub: mem.passkey.pub, pinRoot: mem.passkey.pinRoot } : null),
    pendingPreauth: async () => mem.preauth ?? null,
    clearPreauth: async () => { mem.preauth = undefined; },
    pinnedAgents: async (box?: string) => (box ? (mem.boxPins[box] ?? []) : mem.pins),
    pinAgent: async (p: Bytes, box?: string) => { if (box) mem.boxPins[box] = [p]; else mem.pins = [p]; },
  };
});

const { SealedSocket, enrollThisDevice, sealState, sendRelayFrame } = await import('./sealed-socket');
const { boxStore } = await import('./boxes-store');
const { SealedHub, agentKeysFrom } = await import('../../server/e2e/hub');
const { createEnrollCode, devicePin, storePreauth } = await import('../../server/e2e/devices');
const { deviceFrameHandler } = await import('../../server/e2e/manage');
const { boxPinKey, deriveFromPrf } = await import('../../shared/e2e/passkey');
const { newDeviceCode } = await import('../../shared/e2e/enroll');
const { toB64 } = await import('../../shared/e2e/bytes');

const C = 'CCCCCCCCCCCCCCCCCCCCCC';
const flush = () => new Promise((r) => setTimeout(r, 40));

// Plays the relay: stamps the tab id on browser frames, strips it on the way
// back, and lets a test inject or tamper with frames like a hostile relay would.
class Relay {
  browser: FakeBrowserWs | null = null;
  toBrowserLog: string[] = [];
  tamper: ((s: string) => string) | null = null;
  agentLink = { OPEN: 1, readyState: 1, bufferedAmount: 0, send: (s: string) => this.fromAgent(s) } as unknown as NodeWs;
  hub!: InstanceType<typeof SealedHub>;
  served: string[] = [];

  fromAgent(s: string) {
    const m = /^\{"c":"([A-Za-z0-9_-]{22})"(?:,"p":([01]))?,/.exec(s);
    const plain = m ? `{${s.slice(m[0].length)}` : s;
    const out = this.tamper ? this.tamper(plain) : plain;
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
  mem.pair = undefined; mem.pins = []; mem.boxPins = {}; mem.passkey = undefined; mem.preauth = undefined;
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
  const s = new SealedSocket('wss://relay/ws', 'jwt', { main: true });
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
    const again = new SealedSocket('wss://relay/ws', 'jwt', { main: true });
    let opened = false;
    again.onopen = () => { opened = true; };
    await flush(); await flush();
    expect(opened).toBe(false);
    expect(sealState.get()).toBe('rejected');
  });

  it('a pinned device seals on redial although agent-online arrives with the hello in flight', async () => {
    const { s } = await enrolledSocket();
    s.close();
    await flush();
    const again = new SealedSocket('wss://relay/ws', 'jwt', { main: true });
    again.onmessage = () => {};
    await flush(); await flush();
    expect(sealState.get()).toBe('sealed');
    expect(relay.browser!.sent.filter((f) => f.includes('e2e-hello'))).toHaveLength(1);
  });

  it('sends relay-owned admin frames in the clear and nothing else', async () => {
    const { s } = await enrolledSocket();
    s.send('{"t":"accounts-list"}');
    await flush();
    expect(relay.browser!.sent).toContain('{"t":"accounts-list"}');
  });

  it('sends box rename and revoke to the relay in the clear', async () => {
    const { s } = await enrolledSocket();
    const id = '11111111-1111-4111-8111-111111111111';
    sendRelayFrame({ t: 'box-rename', id, label: 'PC' });
    s.send(JSON.stringify({ t: 'box-revoke', id }));
    await flush();
    expect(relay.browser!.sent).toContain(JSON.stringify({ t: 'box-rename', id, label: 'PC' }));
    expect(relay.browser!.sent).toContain(JSON.stringify({ t: 'box-revoke', id }));
  });

  it('accepts boxes and box-error from the relay without handing them to the app', async () => {
    const { got } = await enrolledSocket();
    boxStore.reset();
    const id = '11111111-1111-4111-8111-111111111111';
    relay.browser!.receive(JSON.stringify({ t: 'boxes', box: null, primary: id, boxes: [{ id, label: 'VPS', online: true, lastSeen: null }] }));
    await flush();
    expect(boxStore.get().frame?.boxes[0].label).toBe('VPS');
    expect(got.some((g) => g.includes('"boxes"'))).toBe(false);
  });

  it('a non-main socket does not drive sealState and pins under its own box', async () => {
    const main = new SealedSocket('wss://relay/ws', 'jwt', { main: true });
    await flush();
    expect(sealState.get()).toBe('enroll');
    main.close();
    await flush();
    const box = '22222222-2222-4222-8222-222222222222';
    const peek = new SealedSocket('wss://relay/ws?box=' + box, 'jwt', { box });
    await flush();
    expect(peek.sealed).toBe('enroll');
    expect(sealState.get()).toBe('enroll');
    const before = sealState.get();
    peek.close(1000);
    await flush();
    expect(sealState.get()).toBe(before);
  });

  it('enrolling on a bound main socket pins only that box', async () => {
    const box = '22222222-2222-4222-8222-222222222222';
    const s = new SealedSocket('wss://relay/ws?box=' + box, 'jwt', { box, main: true });
    s.onmessage = () => {};
    await flush();
    const { code } = await createEnrollCode((relay as unknown as { keys: { pub: Bytes } }).keys.pub);
    await enrollThisDevice(code, 'test');
    await flush();
    expect(mem.boxPins[box]).toHaveLength(1);
    expect(mem.pins).toHaveLength(0);
    expect(sealState.get()).toBe('sealed');
  });
});

describe('SealedSocket with a passkey device key', () => {
  const BOX = '33333333-3333-4333-8333-333333333333';
  const PRF = new Uint8Array(32).fill(5);
  const settle = async () => { for (let i = 0; i < 4; i++) await flush(); };

  function agentWithBoxId() {
    const keys = (relay as unknown as { keys: { pub: Bytes; sign: CryptoKey } }).keys;
    let hub: InstanceType<typeof SealedHub> | null = null;
    hub = new SealedHub({
      keys, link: relay.agentLink, onPeersChanged: () => {}, boxId: BOX,
      intercept: deviceFrameHandler(keys.pub, () => hub, BOX),
      serve: (peer) => peer.on('message', (b: Buffer) => { relay.served.push(b.toString()); }),
    });
    relay.hub = hub;
    return keys;
  }

  function dial(box: string | null = BOX) {
    const s = new SealedSocket(box ? 'wss://relay/ws?box=' + box : 'wss://relay/ws', 'jwt', { box: box ?? undefined, main: true });
    s.onmessage = () => {};
    return s;
  }

  async function pairedWithDeviceCode() {
    const keys = agentWithBoxId();
    mem.passkey = await deriveFromPrf(PRF);
    const { code, secret } = await newDeviceCode(mem.passkey.pub);
    storePreauth(code);
    mem.preauth = secret;
    const s = dial();
    await settle();
    return { keys, s };
  }

  it('the browser that showed the setup command opens the Deck with no enroll step', async () => {
    const { keys } = await pairedWithDeviceCode();
    expect(sealState.get()).toBe('sealed');
    expect(mem.boxPins[BOX]).toEqual([keys.pub]);
    expect(mem.preauth).toBeUndefined();
    expect(devicePin(toB64(mem.passkey!.pub))).toEqual(await boxPinKey(mem.passkey!.pinRoot, BOX));
  });

  it('another browser where the passkey synced opens the Deck from the pin proof alone', async () => {
    const { keys, s } = await pairedWithDeviceCode();
    s.close();
    await flush();
    mem.boxPins = {};
    mem.passkey = await deriveFromPrf(new Uint8Array(PRF));
    dial();
    await settle();
    expect(sealState.get()).toBe('sealed');
    expect(mem.boxPins[BOX]).toEqual([keys.pub]);
  });

  it('a box paired before passkeys: the enroll code enrolls the passkey key and hands over the pin key', async () => {
    const keys = agentWithBoxId();
    mem.passkey = await deriveFromPrf(PRF);
    dial();
    await settle();
    expect(sealState.get()).toBe('enroll');
    const { code } = await createEnrollCode(keys.pub);
    await enrollThisDevice(code, 'laptop');
    await settle();
    expect(sealState.get()).toBe('sealed');
    expect(devicePin(toB64(mem.passkey.pub))).toEqual(await boxPinKey(mem.passkey.pinRoot, BOX));
  });

  it('a pin key never crosses the relay in the clear', async () => {
    await pairedWithDeviceCode();
    const key = toB64(await boxPinKey(mem.passkey!.pinRoot, BOX));
    const wire = [...relay.browser!.sent, ...relay.toBrowserLog].join('\n');
    expect(wire).not.toContain(key);
    expect(wire).not.toContain('device-pin');
  });

  it('an unbound passkey socket waits for its box instead of showing the enroll screen', async () => {
    agentWithBoxId();
    mem.passkey = await deriveFromPrf(PRF);
    dial(null);
    await settle();
    expect(sealState.get()).toBe('connecting');
    expect(relay.browser!.sent.some((f) => f.includes('e2e-hello'))).toBe(false);
  });

  it('refuses an agent key the relay substitutes for a browser with no pin', async () => {
    const { s } = await pairedWithDeviceCode();
    s.close();
    await flush();
    mem.boxPins = {};
    const { generateKeyPairSync: gen } = await import('node:crypto');
    const fake = gen('ed25519').publicKey.export({ type: 'spki', format: 'der' });
    relay.tamper = (f) => (f.includes('"e2e-accept"') ? f.replace(/"agent":"[^"]+"/, `"agent":"${toB64(new Uint8Array(fake.subarray(fake.length - 32)))}"`) : f);
    dial();
    await settle();
    relay.tamper = null;
    expect(sealState.get()).toBe('rejected');
    expect(mem.boxPins[BOX]).toBeUndefined();
  });
});
