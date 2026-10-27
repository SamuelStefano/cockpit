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
  passkey?: PasskeyDevice; preauth: Bytes[]; passkeyBoxes: string[];
} = { pins: [], boxPins: {}, preauth: [], passkeyBoxes: [] };
vi.mock('./device-store', async () => {
  const { publicRaw } = await import('../../shared/e2e/channel');
  const pinsOf = (box?: string) => (box ? (mem.boxPins[box] ?? []) : mem.pins);
  const pin = (p: Bytes, box?: string) => { if (box) mem.boxPins[box] = [p]; else mem.pins = [p]; };
  return {
    deviceKeysFor: async (box?: string) => {
      const ref = mem.passkey ? { pub: mem.passkey.pub, pinRoot: mem.passkey.pinRoot } : null;
      const legacy = !!mem.pair && pinsOf(box).length > 0 && !mem.passkeyBoxes.includes(box ?? '');
      if (mem.passkey && !legacy) return { keys: { pub: mem.passkey.pub, sign: mem.passkey.pair.privateKey }, passkey: ref, upgrade: null };
      mem.pair ??= await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']) as unknown as KeyPair;
      return { keys: { pub: await publicRaw(mem.pair.publicKey), sign: mem.pair.privateKey }, passkey: null, upgrade: ref };
    },
    forgetBox: async (box?: string) => { if (box) mem.boxPins[box] = []; else mem.pins = []; mem.passkeyBoxes = mem.passkeyBoxes.filter((b) => b !== (box ?? '')); },
    markPasskeyBox: async (box?: string) => { if (!mem.passkeyBoxes.includes(box ?? '')) mem.passkeyBoxes.push(box ?? ''); },
    pinnedAgents: async (box?: string) => pinsOf(box),
    pinAgent: async (p: Bytes, box?: string) => pin(p, box),
    pinAgentIfEmpty: async (p: Bytes, box?: string) => { if (pinsOf(box).length) return false; pin(p, box); return true; },
  };
});
vi.mock('./preauth-store', () => ({
  pendingPreauths: () => [...mem.preauth],
  dropPreauth: (s: Bytes) => { mem.preauth = mem.preauth.filter((x) => x !== s); },
}));

const { SealedSocket, enrollThisDevice, forgetThisBox, retrySeal, sealState, sendRelayFrame, TOFU_UNTIL } = await import('./sealed-socket');
const { boxStore } = await import('./boxes-store');
const { SealedHub, agentKeysFrom, tofuWindow } = await import('../../server/e2e/hub');
const { createEnrollCode, devicePin, listDevices, revokeDevice, storePreauth } = await import('../../server/e2e/devices');
const { deviceFrameHandler } = await import('../../server/e2e/manage');
const { boxPinKey, deriveFromPrf } = await import('../../shared/e2e/passkey');
const { newDeviceCode } = await import('../../shared/e2e/enroll');
const { toB64 } = await import('../../shared/e2e/bytes');

const flush = () => new Promise((r) => setTimeout(r, 40));
let tabs = 0;

// Plays the relay: stamps each tab's own id on its frames, routes the agent's
// answers back to that tab only, tells the agent when a tab goes away, and lets
// a test inject or tamper with frames like a hostile relay would.
class Relay {
  browser: FakeBrowserWs | null = null;
  tabs = new Map<string, FakeBrowserWs>();
  toBrowserLog: string[] = [];
  tamper: ((s: string) => string) | null = null;
  agentLink = { OPEN: 1, readyState: 1, bufferedAmount: 0, send: (s: string) => this.fromAgent(s) } as unknown as NodeWs;
  hub!: InstanceType<typeof SealedHub>;
  served: string[] = [];

  fromAgent(s: string) {
    const m = /^\{"c":"([A-Za-z0-9_-]{22})"(?:,"p":([01]))?,/.exec(s);
    const plain = m ? `{${s.slice(m[0].length)}` : s;
    const out = this.tamper ? this.tamper(plain) : plain;
    if (!out) return;
    this.toBrowserLog.push(out);
    (m ? this.tabs.get(m[1]) : this.browser)?.receive(out);
  }

  held: [string, string][] | null = null;
  fromBrowser(c: string, s: string) {
    if (!s.startsWith('{"t":"e2e')) return;
    if (this.held) { this.held.push([c, s]); return; }
    this.hub.handle(`${s.slice(0, -1)},"c":"${c}"}`);
  }
  release() {
    const q = this.held ?? [];
    this.held = null;
    for (const [c, s] of q) this.fromBrowser(c, s);
  }
  gone(c: string) {
    this.tabs.delete(c);
    this.hub.handle(JSON.stringify({ t: 'e2e-gone', c }));
  }
}

class FakeBrowserWs {
  static relay: Relay;
  readonly c = String(++tabs).padStart(22, 'C');
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  bufferedAmount = 0;
  sent: string[] = [];
  constructor() {
    FakeBrowserWs.relay.browser = this;
    FakeBrowserWs.relay.tabs.set(this.c, this);
    setTimeout(() => { this.readyState = 1; this.onopen?.(); this.receive('{"t":"agent-online"}'); }, 0);
  }
  send(s: string) { this.sent.push(s); FakeBrowserWs.relay.fromBrowser(this.c, s); }
  close(code = 1000, reason = '') {
    if (this.readyState === 3) return;
    this.readyState = 3;
    FakeBrowserWs.relay.gone(this.c);
    this.onclose?.({ code, reason });
  }
  receive(s: string) { if (this.readyState !== 3) this.onmessage?.({ data: s }); }
}
(FakeBrowserWs as unknown as { OPEN: number }).OPEN = 1;

let relay: Relay;

beforeEach(async () => {
  process.env.DECK_AGENT_DIR = mkdtempSync(join(tmpdir(), 'deck-sealed-'));
  mem.pair = undefined; mem.pins = []; mem.boxPins = {}; mem.passkey = undefined; mem.preauth = []; mem.passkeyBoxes = [];
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
afterEach(() => { for (const t of [...relay.tabs.values()]) t.close(); vi.unstubAllGlobals(); });

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

  function hubFor(boxId: string) {
    const keys = (relay as unknown as { keys: { pub: Bytes; sign: CryptoKey } }).keys;
    relay.hub = new SealedHub({ keys, link: relay.agentLink, onPeersChanged: () => {}, boxId, serve: () => {} });
  }

  it('an enroll code from a box the relay put in place of the dialed one pins nothing', async () => {
    const box = '22222222-2222-4222-8222-222222222222';
    hubFor('44444444-4444-4444-8444-444444444444');
    const s = new SealedSocket('wss://relay/ws?box=' + box, 'jwt', { box, main: true });
    s.onmessage = () => {};
    await flush();
    const { code } = await createEnrollCode((relay as unknown as { keys: { pub: Bytes } }).keys.pub);
    await expect(enrollThisDevice(code, 'test')).rejects.toThrow();
    expect(mem.boxPins[box]).toBeUndefined();
    expect(sealState.get()).toBe('enroll-failed');
  });

  it('an enroll code never replaces the pin of a box this device already trusts', async () => {
    const box = '22222222-2222-4222-8222-222222222222';
    hubFor(box);
    const s = new SealedSocket('wss://relay/ws?box=' + box, 'jwt', { box, main: true });
    s.onmessage = () => {};
    await flush();
    const other = new Uint8Array(32).fill(3);
    mem.boxPins[box] = [other];
    const { code } = await createEnrollCode((relay as unknown as { keys: { pub: Bytes } }).keys.pub);
    await expect(enrollThisDevice(code, 'test')).rejects.toThrow('já confia');
    expect(mem.boxPins[box]).toEqual([other]);
  });

  it('enrolling on a bound main socket pins only that box', async () => {
    const box = '22222222-2222-4222-8222-222222222222';
    hubFor(box);
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
    mem.preauth = [secret];
    const s = dial();
    await settle();
    return { keys, s };
  }

  it('the browser that showed the setup command opens the Deck with no enroll step', async () => {
    const { keys } = await pairedWithDeviceCode();
    expect(sealState.get()).toBe('sealed');
    expect(mem.boxPins[BOX]).toEqual([keys.pub]);
    expect(mem.preauth).toEqual([]);
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
    await vi.waitFor(() => expect(sealState.get()).toBe('enroll'));
    relay.tamper = null;
    expect(mem.boxPins[BOX]).toBeUndefined();
  });

  it('never sends e2e-preauth for a box it already pinned, even when the relay says "unknown device"', async () => {
    const { keys, s } = await pairedWithDeviceCode();
    s.close();
    await flush();
    const { secret } = await newDeviceCode(mem.passkey!.pub);
    mem.preauth = [secret];
    dial();
    await settle();
    relay.browser!.receive('{"t":"e2e-unknown-device"}');
    await settle();
    expect(relay.browser!.sent.some((f) => f.includes('e2e-preauth'))).toBe(false);
    expect(mem.boxPins[BOX]).toEqual([keys.pub]);
    expect(sealState.get()).toBe('sealed');
  });

  it('a box the relay routes this dial to cannot redeem a secret meant for another box', async () => {
    const OTHER = '44444444-4444-4444-8444-444444444444';
    const keys = (relay as unknown as { keys: { pub: Bytes; sign: CryptoKey } }).keys;
    relay.hub = new SealedHub({ keys, link: relay.agentLink, onPeersChanged: () => {}, boxId: OTHER, serve: () => {} });
    mem.passkey = await deriveFromPrf(PRF);
    const { code, secret } = await newDeviceCode(mem.passkey.pub);
    storePreauth(code);
    mem.preauth = [secret];
    dial();
    await settle();
    expect(sealState.get()).not.toBe('sealed');
    expect(mem.boxPins[BOX]).toBeUndefined();
    expect(listDevices()).toHaveLength(0);
  });

  it('a forged "pre-authorization failed" only delays it: the browser tries again and seals', async () => {
    agentWithBoxId();
    mem.passkey = await deriveFromPrf(PRF);
    const { code, secret } = await newDeviceCode(mem.passkey.pub);
    storePreauth(code);
    mem.preauth = [secret];
    let forged = false;
    relay.tamper = (f) => {
      if (!forged && f.includes('"e2e-preauthed"')) { forged = true; return '{"t":"e2e-preauth-failed"}'; }
      return f;
    };
    dial();
    await settle();
    expect(sealState.get()).not.toBe('rejected');
    await new Promise((r) => setTimeout(r, 2_300));
    await settle();
    relay.tamper = null;
    expect(sealState.get()).toBe('sealed');
    expect(mem.preauth).toEqual([]);
  }, 10_000);

  it('a retry while the hello is in flight does not start a second handshake', async () => {
    const { s } = await pairedWithDeviceCode();
    s.close();
    await flush();
    relay.held = [];
    dial();
    await flush();
    retrySeal();
    await flush();
    relay.release();
    await settle();
    expect(relay.browser!.sent.filter((f) => f.includes('e2e-hello'))).toHaveLength(1);
    expect(sealState.get()).toBe('sealed');
  });

  it('an enrolled random-key browser hands the box its passkey key, then dials with it', async () => {
    const keys = (relay as unknown as { keys: { pub: Bytes; sign: CryptoKey } }).keys;
    let hub: InstanceType<typeof SealedHub> | null = null;
    hub = new SealedHub({ keys, link: relay.agentLink, onPeersChanged: () => {}, boxId: BOX, intercept: deviceFrameHandler(keys.pub, () => hub, BOX), serve: () => {} });
    relay.hub = hub;
    const s = dial();
    await settle();
    const { code } = await createEnrollCode(keys.pub);
    await enrollThisDevice(code, 'laptop');
    await settle();
    expect(sealState.get()).toBe('sealed');
    mem.passkey = await deriveFromPrf(PRF);
    retrySeal();
    await settle();
    expect(mem.passkeyBoxes).toContain(BOX);
    expect(devicePin(toB64(mem.passkey.pub))).toEqual(await boxPinKey(mem.passkey.pinRoot, BOX));
    s.close();
    await flush();
    dial();
    await settle();
    expect(sealState.get()).toBe('sealed');
    expect(relay.browser!.sent.find((f) => f.includes('e2e-hello'))).toContain(toB64(mem.passkey.pub));
  });

  it('a passkey key revoked on the box is not re-added by another synced browser still on its random key', async () => {
    const keys = agentWithBoxId();
    const s = dial();
    await settle();
    const { code } = await createEnrollCode(keys.pub);
    await enrollThisDevice(code, 'laptop');
    await vi.waitFor(() => expect(sealState.get()).toBe('sealed'));
    mem.passkey = await deriveFromPrf(PRF);
    retrySeal();
    const pk = toB64(mem.passkey.pub);
    await vi.waitFor(() => expect(listDevices().map((d) => d.pub)).toContain(pk));
    revokeDevice(pk);
    s.close();
    await flush();
    mem.passkeyBoxes = [];
    dial();
    await vi.waitFor(() => expect(sealState.get()).toBe('sealed'));
    await settle();
    expect(relay.browser!.sent.some((f) => f.includes('e2e-hello') && !f.includes(pk))).toBe(true);
    expect(listDevices().map((d) => d.pub)).not.toContain(pk);
    expect(devicePin(pk)).toBeNull();
  });

  it('forgetting the box drops its pin and passkey mark and closes the channel', async () => {
    await pairedWithDeviceCode();
    expect(mem.passkeyBoxes).toContain(BOX);
    let closed = false;
    relay.browser!.onclose = () => { closed = true; };
    expect(await forgetThisBox()).toBe(true);
    await vi.waitFor(() => expect(closed).toBe(true));
    expect(mem.boxPins[BOX]).toEqual([]);
    expect(mem.passkeyBoxes).not.toContain(BOX);
    expect(closed).toBe(true);
  });

  it('a relay that puts a bad pin proof in front of a browser with no pin cannot make it sticky-rejected', async () => {
    const { s } = await pairedWithDeviceCode();
    s.close();
    await flush();
    mem.boxPins = {};
    relay.tamper = (f) => (f.includes('"e2e-accept"') ? f.replace(/"pin":"[^"]+"/, `"pin":"${toB64(new Uint8Array(32).fill(1))}"`) : f);
    dial();
    await vi.waitFor(() => expect(sealState.get()).toBe('enroll'));
    relay.tamper = null;
    expect(mem.boxPins[BOX] ?? []).toEqual([]);
  });

  it('a box with no devices trusts this browser on first use, and the passkey pin key follows', async () => {
    const keys = (relay as unknown as { keys: { pub: Bytes; sign: CryptoKey } }).keys;
    let hub: InstanceType<typeof SealedHub> | null = null;
    hub = new SealedHub({
      keys, link: relay.agentLink, onPeersChanged: () => {}, boxId: BOX, tofu: tofuWindow(Date.now()),
      intercept: deviceFrameHandler(keys.pub, () => hub, BOX), serve: () => {},
    });
    relay.hub = hub;
    mem.passkey = await deriveFromPrf(PRF);
    dial();
    await settle();
    expect(sealState.get()).toBe('sealed');
    expect(mem.boxPins[BOX]).toEqual([keys.pub]);
    expect(devicePin(toB64(mem.passkey.pub))).toEqual(await boxPinKey(mem.passkey.pinRoot, BOX));
  });

  it('after the migration window the browser refuses a first-use answer', async () => {
    const keys = (relay as unknown as { keys: { pub: Bytes; sign: CryptoKey } }).keys;
    let hub: InstanceType<typeof SealedHub> | null = null;
    hub = new SealedHub({
      keys, link: relay.agentLink, onPeersChanged: () => {}, boxId: BOX, tofu: tofuWindow(TOFU_UNTIL),
      intercept: deviceFrameHandler(keys.pub, () => hub, BOX), serve: () => {},
    });
    relay.hub = hub;
    mem.passkey = await deriveFromPrf(PRF);
    const now = vi.spyOn(Date, 'now').mockReturnValue(TOFU_UNTIL);
    try {
      dial();
      await settle();
    } finally {
      now.mockRestore();
    }
    expect(sealState.get()).not.toBe('sealed');
    expect(mem.boxPins[BOX] ?? []).toEqual([]);
  });
});
