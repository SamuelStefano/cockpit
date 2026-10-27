import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import type { WebSocket } from 'ws';
import { SealedHub, agentKeysFrom, MAX_CHANNEL_MS, TOFU_WINDOW_MS, tofuWindow, type SealedPeer, type TofuWindow } from './hub';
import { createEnrollCode, devicePin, listDevices, revokeDevice, storePreauth, trustFirstDevice } from './devices';
import { TOFU_UNTIL } from '../../shared/e2e/tofu';
import { deviceFrameHandler } from './manage';
import {
  AgentKeyError, DeviceHandshake, enrollRequest, enrollResult, preauthRequest, preauthResult, type DeviceKeys, type PinCheck,
} from '../../shared/e2e/device';
import { publicRaw, type KeyPair } from '../../shared/e2e/channel';
import { ENROLL_TTL_MS, newDeviceCode } from '../../shared/e2e/enroll';
import { boxPinKey, checkPinProof, deriveFromPrf } from '../../shared/e2e/passkey';
import { randomBytes, toB64, type Bytes } from '../../shared/e2e/bytes';

const C = 'AAAAAAAAAAAAAAAAAAAAAA';

function fakeLink() {
  const sent: string[] = [];
  return { sent, link: { OPEN: 1, readyState: 1, bufferedAmount: 0, send: (s: string) => sent.push(s) } as unknown as WebSocket };
}

async function agentKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return agentKeysFrom(
    privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  );
}

async function deviceKeys(): Promise<DeviceKeys> {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']) as unknown as KeyPair;
  return { pub: await publicRaw(pair.publicKey), sign: pair.privateKey };
}

// Waits for the hubs' own work, not a fixed delay: a loaded runner (the PC under
// a parallel suite) can take longer than any sleep for the Ed25519/X25519 steps.
const hubs = new Set<SealedHub>();
type Inner = { queue: Map<string, Promise<unknown>>; peers: Map<string, { chain?: Promise<unknown> }> };
async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 5));
  for (let i = 0; i < 3; i++) {
    for (const h of hubs) {
      const inner = h as unknown as Inner;
      await Promise.all([...inner.queue.values()]);
      await Promise.all([...inner.peers.values()].map((p) => p.chain));
    }
    await new Promise((r) => setTimeout(r, 0));
  }
}
const last = (sent: string[]) => JSON.parse(sent[sent.length - 1]) as Record<string, unknown>;
const toAgent = (m: Record<string, unknown>, c = C) => JSON.stringify({ ...m, c });

async function setup() {
  const keys = await agentKeys();
  const { sent, link } = fakeLink();
  const served: SealedPeer[] = [];
  const got: string[] = [];
  const hub = new SealedHub({
    keys, link, onPeersChanged: () => {},
    serve: (p) => { served.push(p); p.on('message', (b: Buffer) => got.push(b.toString())); },
  });
  hubs.add(hub);
  return { keys, sent, hub, served, got };
}

async function enroll(h: Awaited<ReturnType<typeof setup>>, dev: DeviceKeys): Promise<Bytes> {
  const { code } = await createEnrollCode(h.keys.pub);
  const { frame, parsed } = await enrollRequest(code, dev.pub, 'phone');
  h.hub.handle(toAgent(frame)); await flush();
  const pinned = await enrollResult(last(h.sent), parsed, dev.pub);
  if (!pinned) throw new Error('enroll failed');
  return pinned.agentPub;
}

async function open(h: Awaited<ReturnType<typeof setup>>, dev: DeviceKeys, pinned: Bytes[]) {
  const d = new DeviceHandshake(dev, pinned);
  h.hub.handle(toAgent(await d.hello())); await flush();
  const { confirm, channel } = await d.accept(last(h.sent));
  h.hub.handle(toAgent(confirm)); await flush();
  return channel;
}

beforeEach(() => { hubs.clear(); process.env.DECK_AGENT_DIR = mkdtempSync(join(tmpdir(), 'deck-e2e-')); });

describe('sealed hub', () => {
  it('enrolls a device and serves its sealed frames', async () => {
    const h = await setup();
    const dev = await deviceKeys();
    const pinned = await enroll(h, dev);
    expect(pinned).toEqual(h.keys.pub);
    const channel = await open(h, dev, [pinned]);
    expect(h.served).toHaveLength(1);
    const f = await channel.seal('{"t":"list"}');
    h.hub.handle(toAgent({ t: 'e2e', ...f })); await flush();
    expect(h.got).toEqual(['{"t":"list"}']);
  });

  it('encrypts what the agent sends and the relay sees no plaintext', async () => {
    const h = await setup();
    const dev = await deviceKeys();
    const channel = await open(h, dev, [await enroll(h, dev)]);
    h.served[0].send('{"t":"history","secret":"sk-ant-xyz"}'); await flush();
    const wire = h.sent[h.sent.length - 1];
    expect(wire).not.toContain('sk-ant');
    expect(wire.startsWith(`{"c":"${C}","p":0,"t":"e2e"`)).toBe(true);
    const m = JSON.parse(wire);
    expect(await channel.open(m)).toContain('sk-ant-xyz');
  });

  it('refuses a device that never enrolled', async () => {
    const h = await setup();
    const stranger = await deviceKeys();
    const d = new DeviceHandshake(stranger, [h.keys.pub]);
    h.hub.handle(toAgent(await d.hello())); await flush();
    expect(last(h.sent).t).toBe('e2e-unknown-device');
    expect(h.served).toHaveLength(0);
  });

  it('refuses a relay that replays an enrolled device key without its private key', async () => {
    const h = await setup();
    const dev = await deviceKeys();
    const pinned = await enroll(h, dev);
    const relay = await deviceKeys();
    const d = new DeviceHandshake({ pub: dev.pub, sign: relay.sign }, [pinned]);
    h.hub.handle(toAgent(await d.hello())); await flush();
    const { confirm } = await d.accept(last(h.sent));
    h.hub.handle(toAgent(confirm)); await flush();
    expect(last(h.sent).t).toBe('e2e-reset');
    expect(h.served).toHaveLength(0);
  });

  it('refuses an enrollment with a guessed code', async () => {
    const h = await setup();
    const dev = await deviceKeys();
    await createEnrollCode(h.keys.pub);
    const other = await agentKeys();
    const { code } = await (await import('../../shared/e2e/enroll')).newEnrollCode(other.pub);
    const { frame } = await enrollRequest(code, dev.pub, 'x');
    h.hub.handle(toAgent(frame)); await flush();
    expect(last(h.sent).t).toBe('e2e-enroll-failed');
    expect(listDevices()).toHaveLength(0);
  });

  it('burns the code after one use', async () => {
    const h = await setup();
    const a = await deviceKeys();
    const b = await deviceKeys();
    const { code } = await createEnrollCode(h.keys.pub);
    h.hub.handle(toAgent((await enrollRequest(code, a.pub, 'a')).frame)); await flush();
    h.hub.handle(toAgent((await enrollRequest(code, b.pub, 'b')).frame, 'BBBBBBBBBBBBBBBBBBBBBB')); await flush();
    expect(listDevices().map((d) => d.label)).toEqual(['a']);
  });

  it('drops the channel when a frame is tampered with', async () => {
    const h = await setup();
    const dev = await deviceKeys();
    const channel = await open(h, dev, [await enroll(h, dev)]);
    const f = await channel.seal('{"t":"list"}');
    h.hub.handle(toAgent({ t: 'e2e', s: f.s, d: f.d.replace(/^./, f.d[0] === 'A' ? 'B' : 'A') })); await flush();
    expect(h.got).toEqual([]);
    expect(h.hub.peers.size).toBe(0);
  });

  it('closes the channel of a revoked device', async () => {
    const h = await setup();
    const dev = await deviceKeys();
    await open(h, dev, [await enroll(h, dev)]);
    revokeDevice(toB64(dev.pub));
    h.hub.dropDevice(toB64(dev.pub));
    expect(h.hub.peers.size).toBe(0);
  });

  it('sweeps a channel whose device was revoked by another process', async () => {
    const h = await setup();
    const dev = await deviceKeys();
    await open(h, dev, [await enroll(h, dev)]);
    revokeDevice(toB64(dev.pub));
    h.hub.sweep();
    expect(h.hub.peers.size).toBe(0);
  });

  it('expires a channel after its lifetime', async () => {
    const h = await setup();
    const dev = await deviceKeys();
    await open(h, dev, [await enroll(h, dev)]);
    h.hub.sweep(Date.now() + MAX_CHANNEL_MS + 1);
    expect(h.hub.peers.size).toBe(0);
  });

  it('keeps lastSeen out of the trust file', async () => {
    const h = await setup();
    const dev = await deviceKeys();
    await open(h, dev, [await enroll(h, dev)]);
    const { readFileSync } = await import('node:fs');
    const trustFile = JSON.parse(readFileSync(join(process.env.DECK_AGENT_DIR!, 'devices.json'), 'utf8'));
    expect(trustFile[0].lastSeen).toBeUndefined();
    expect(listDevices()[0].lastSeen).toBeTruthy();
  });

  it('ignores frames with a malformed channel id', async () => {
    const h = await setup();
    expect(h.hub.handle(JSON.stringify({ t: 'e2e-hello', c: '../x' }))).toBe(true);
    await flush();
    expect(h.sent).toHaveLength(0);
  });
});

const BOX = '11111111-1111-4111-8111-111111111111';
const OTHER_BOX = '22222222-2222-4222-8222-222222222222';
const PRF = new Uint8Array(32).fill(9);

async function passkeySetup(boxId = BOX, tofu?: TofuWindow) {
  const keys = await agentKeys();
  const { sent, link } = fakeLink();
  const got: string[] = [];
  let hub: SealedHub | null = null;
  hub = new SealedHub({
    keys, link, onPeersChanged: () => {}, boxId, tofu,
    intercept: deviceFrameHandler(keys.pub, () => hub, boxId),
    serve: (p) => { p.on('message', (b: Buffer) => got.push(b.toString())); },
  });
  hubs.add(hub);
  return { keys, sent, hub, got };
}

async function passkeyDevice(prf = PRF) {
  const d = await deriveFromPrf(prf);
  return { ...d, keys: { pub: d.pub, sign: d.pair.privateKey } as DeviceKeys };
}

type PSetup = Awaited<ReturnType<typeof passkeySetup>>;

async function preauth(h: PSetup, dev: DeviceKeys, secret: Bytes, label = 'Mac · Chrome') {
  h.hub.handle(toAgent(await preauthRequest(secret, dev.pub, label, BOX))); await flush();
  return preauthResult(last(h.sent), secret, dev.pub, BOX);
}

async function sealWithPin(h: PSetup, dev: DeviceKeys, pinned: Bytes[], check: PinCheck | null) {
  const d = new DeviceHandshake(dev, pinned, check);
  h.hub.handle(toAgent(await d.hello())); await flush();
  const accepted = await d.accept(last(h.sent));
  h.hub.handle(toAgent(accepted.confirm)); await flush();
  return accepted;
}

function checker(pinRoot: CryptoKey, box: string, devicePub: Bytes): PinCheck {
  return async (agentPub, proof) => checkPinProof(await boxPinKey(pinRoot, box), proof, agentPub, devicePub, box);
}

describe('passkey device: pre-authorization at pairing', () => {
  it('enrolls the device named by DECK_DEVICE_CODE and returns a grant for the real agent key', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    const pinned = await preauth(h, dev.keys, secret);
    expect(pinned).toEqual(h.keys.pub);
    expect(listDevices().map((d) => d.label)).toEqual(['Mac · Chrome']);
  });

  it('refuses a relay that sends its own key with the code fingerprint of another device', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const relayDev = await deviceKeys();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    expect(await preauth(h, relayDev, secret)).toBeNull();
    expect(last(h.sent).t).toBe('e2e-preauth-failed');
    expect(listDevices()).toHaveLength(0);
  });

  it('refuses a wrong MAC (relay without the secret)', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const { code } = await newDeviceCode(dev.pub);
    storePreauth(code);
    expect(await preauth(h, dev.keys, randomBytes(16))).toBeNull();
    expect(listDevices()).toHaveLength(0);
  });

  it('is single use: a replayed request does not enroll again', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    const frame = await preauthRequest(secret, dev.keys.pub, 'a', BOX);
    h.hub.handle(toAgent(frame)); await flush();
    expect(last(h.sent).t).toBe('e2e-preauthed');
    revokeDevice(toB64(dev.pub));
    h.hub.handle(toAgent(frame, 'BBBBBBBBBBBBBBBBBBBBBB')); await flush();
    expect(last(h.sent).t).toBe('e2e-preauth-failed');
    expect(listDevices()).toHaveLength(0);
  });

  it('refuses an expired pre-authorization', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code, Date.now() - ENROLL_TTL_MS - 1);
    expect(await preauth(h, dev.keys, secret)).toBeNull();
    expect(listDevices()).toHaveLength(0);
  });

  it('a grant does not verify for an agent key the relay substitutes', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    h.hub.handle(toAgent(await preauthRequest(secret, dev.keys.pub, 'a', BOX))); await flush();
    const forged = { ...last(h.sent), agent: toB64((await agentKeys()).pub) };
    expect(await preauthResult(forged, secret, dev.pub, BOX)).toBeNull();
  });
});

describe('passkey device: agent pin proof for a browser with no pin', () => {
  async function enrolledWithPin() {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    const agentPub = (await preauth(h, dev.keys, secret))!;
    const first = await sealWithPin(h, dev.keys, [agentPub], checker(dev.pinRoot, BOX, dev.pub));
    expect(first.hasPin).toBe(false);
    const key = await boxPinKey(dev.pinRoot, BOX);
    const f = await first.channel.seal(JSON.stringify({ t: 'device-pin', box: BOX, key: toB64(key) }));
    h.hub.handle(toAgent({ t: 'e2e', ...f })); await flush();
    return { h, dev, key };
  }

  it('a new browser with the same passkey pins the agent from the proof alone', async () => {
    const { h } = await enrolledWithPin();
    const synced = await passkeyDevice();
    const accepted = await sealWithPin(h, synced.keys, [], checker(synced.pinRoot, BOX, synced.pub));
    expect(accepted.newPin).toBe(true);
    expect(accepted.hasPin).toBe(true);
    expect(accepted.agentPub).toEqual(h.keys.pub);
    expect(h.hub.peers.get(C)?.devicePub).toBe(toB64(synced.pub));
  });

  it('refuses a substituted agent key, a bad proof, and a proof for another box', async () => {
    const { h, dev } = await enrolledWithPin();
    const d = new DeviceHandshake(dev.keys, [], checker(dev.pinRoot, BOX, dev.pub));
    h.hub.handle(toAgent(await d.hello())); await flush();
    const real = last(h.sent);
    const relayAgent = await agentKeys();
    await expect(d.accept({ ...real, agent: toB64(relayAgent.pub) })).rejects.toThrow();

    const d2 = new DeviceHandshake(dev.keys, [], checker(dev.pinRoot, BOX, dev.pub));
    h.hub.handle(toAgent(await d2.hello())); await flush();
    await expect(d2.accept({ ...last(h.sent), pin: toB64(randomBytes(32)) })).rejects.toThrow();

    const d3 = new DeviceHandshake(dev.keys, [], checker(dev.pinRoot, OTHER_BOX, dev.pub));
    h.hub.handle(toAgent(await d3.hello())); await flush();
    await expect(d3.accept(last(h.sent))).rejects.toThrow();
  });

  // The other box knows only its own pin key, and it can claim any box id.
  it('a compromised box holding its own pin key cannot answer for another box', async () => {
    const { dev } = await enrolledWithPin();
    const { setDevicePin } = await import('./devices');
    setDevicePin(toB64(dev.pub), await boxPinKey(dev.pinRoot, OTHER_BOX));
    const evil = await passkeySetup(BOX);
    const d = new DeviceHandshake(dev.keys, [], checker(dev.pinRoot, BOX, dev.pub));
    evil.hub.handle(toAgent(await d.hello())); await flush();
    await expect(d.accept(last(evil.sent))).rejects.toThrow();
  });

  it('a device that already pinned this box ignores a proof for a different agent key', async () => {
    const { h, dev } = await enrolledWithPin();
    const d = new DeviceHandshake(dev.keys, [randomBytes(32)], checker(dev.pinRoot, BOX, dev.pub));
    h.hub.handle(toAgent(await d.hello())); await flush();
    await expect(d.accept(last(h.sent))).rejects.toThrow('not pinned');
  });

  it('stores no pin key named for another box', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    const agentPub = (await preauth(h, dev.keys, secret))!;
    const s = await sealWithPin(h, dev.keys, [agentPub], null);
    const f = await s.channel.seal(JSON.stringify({ t: 'device-pin', box: OTHER_BOX, key: toB64(await boxPinKey(dev.pinRoot, OTHER_BOX)) }));
    h.hub.handle(toAgent({ t: 'e2e', ...f })); await flush();
    expect(devicePin(toB64(dev.pub))).toBeNull();
  });

  it('revoking the device deletes its pin key, and the device list never carries it', async () => {
    const { dev, key } = await enrolledWithPin();
    expect(devicePin(toB64(dev.pub))).toEqual(key);
    expect(JSON.stringify(listDevices())).not.toContain(toB64(key));
    revokeDevice(toB64(dev.pub));
    expect(devicePin(toB64(dev.pub))).toBeNull();
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(join(process.env.DECK_AGENT_DIR!, 'devices.json'), 'utf8')).not.toContain(toB64(key));
  });

  it('never puts the PRF-derived secrets or the device code secret on the relay wire', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    const browserFrames: string[] = [];
    const frame = await preauthRequest(secret, dev.keys.pub, 'a', BOX);
    browserFrames.push(JSON.stringify(frame));
    h.hub.handle(toAgent(frame)); await flush();
    const agentPub = (await preauthResult(last(h.sent), secret, dev.pub, BOX))!;
    const key = await boxPinKey(dev.pinRoot, BOX);
    const s = await sealWithPin(h, dev.keys, [agentPub], checker(dev.pinRoot, BOX, dev.pub));
    const f = await s.channel.seal(JSON.stringify({ t: 'device-pin', box: BOX, key: toB64(key) }));
    browserFrames.push(JSON.stringify({ t: 'e2e', ...f }));
    h.hub.handle(toAgent({ t: 'e2e', ...f })); await flush();
    const wire = [...browserFrames, ...h.sent].join('\n');
    for (const secretText of [toB64(key), toB64(secret), toB64(PRF), code]) expect(wire).not.toContain(secretText);
  });
});

async function sealed(h: PSetup, dev: DeviceKeys, pinned: Bytes[], c = C) {
  const d = new DeviceHandshake(dev, pinned);
  h.hub.handle(toAgent(await d.hello(), c)); await flush();
  const accepted = await d.accept(last(h.sent));
  h.hub.handle(toAgent(accepted.confirm, c)); await flush();
  return accepted;
}

async function sendSealed(h: PSetup, channel: Awaited<ReturnType<typeof sealed>>['channel'], m: Record<string, unknown>, c = C) {
  const f = await channel.seal(JSON.stringify(m));
  h.hub.handle(toAgent({ t: 'e2e', ...f }, c)); await flush();
}

async function lastSealed(h: PSetup, channel: Awaited<ReturnType<typeof sealed>>['channel']) {
  return JSON.parse(await channel.open(last(h.sent) as { s: unknown; d: unknown })) as Record<string, unknown>;
}

describe('pre-authorization grants are bound to a box and survive a lost answer', () => {
  it('a box the relay routed another box\'s dial to refuses the request and burns nothing', async () => {
    const h = await passkeySetup(BOX);
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    h.hub.handle(toAgent(await preauthRequest(secret, dev.keys.pub, 'a', OTHER_BOX))); await flush();
    expect(last(h.sent).t).toBe('e2e-preauth-failed');
    expect(listDevices()).toHaveLength(0);
    expect(await preauth(h, dev.keys, secret)).toEqual(h.keys.pub);
  });

  it('the grant only verifies for the box id the browser asked for', async () => {
    const h = await passkeySetup(BOX);
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    h.hub.handle(toAgent(await preauthRequest(secret, dev.keys.pub, 'a', BOX))); await flush();
    expect(await preauthResult(last(h.sent), secret, dev.pub, BOX)).toEqual(h.keys.pub);
    expect(await preauthResult(last(h.sent), secret, dev.pub, OTHER_BOX)).toBeNull();
  });

  it('the same device redeems again within the window when the grant was lost, without a second entry', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const { code, secret } = await newDeviceCode(dev.pub);
    storePreauth(code);
    expect(await preauth(h, dev.keys, secret)).toEqual(h.keys.pub);
    expect(await preauth(h, dev.keys, secret)).toEqual(h.keys.pub);
    expect(listDevices()).toHaveLength(1);
  });

  it('an enroll grant names the box that answered', async () => {
    const h = await passkeySetup(BOX);
    const dev = await deviceKeys();
    const { code } = await createEnrollCode(h.keys.pub);
    const { frame, parsed } = await enrollRequest(code, dev.pub, 'x');
    h.hub.handle(toAgent(frame)); await flush();
    const r = await enrollResult(last(h.sent), parsed, dev.pub);
    expect(r?.box).toBe(BOX);
    expect(await enrollResult({ ...last(h.sent), box: OTHER_BOX }, parsed, dev.pub)).toBeNull();
  });
});

describe('trust on first use for a box with no devices', () => {
  const open30 = () => tofuWindow(Date.now());

  it('trusts the first device, says so in the accept, and logs it on the box', async () => {
    const h = await passkeySetup(BOX, open30());
    const dev = await deviceKeys();
    const logs: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => { logs.push(a.join(' ')); };
    try {
      const d = new DeviceHandshake(dev, [], null, { tofu: true, label: 'Mac · Chrome' });
      h.hub.handle(toAgent(await d.hello())); await flush();
      expect(last(h.sent).tofu).toBe(true);
      const accepted = await d.accept(last(h.sent));
      expect(accepted.tofu).toBe(true);
      h.hub.handle(toAgent(accepted.confirm)); await flush();
    } finally { console.error = orig; }
    expect(h.hub.peers.size).toBe(1);
    expect(listDevices().map((x) => x.label)).toEqual(['Mac · Chrome']);
    expect(logs.some((l) => /first device trusted on first use \([0-9a-f]{16}…\)/.test(l))).toBe(true);
  });

  it('refuses a second device once the first got in', async () => {
    const h = await passkeySetup(BOX, open30());
    await sealedTofu(h, await deviceKeys());
    const second = new DeviceHandshake(await deviceKeys(), [], null, { tofu: true });
    h.hub.handle(toAgent(await second.hello(), 'BBBBBBBBBBBBBBBBBBBBBB')); await flush();
    expect(last(h.sent).t).toBe('e2e-unknown-device');
    expect(listDevices()).toHaveLength(1);
  });

  it('of two racing first-use handshakes only one is trusted', async () => {
    const h = await passkeySetup(BOX, open30());
    const a = new DeviceHandshake(await deviceKeys(), [], null, { tofu: true });
    const b = new DeviceHandshake(await deviceKeys(), [], null, { tofu: true });
    h.hub.handle(toAgent(await a.hello(), 'BBBBBBBBBBBBBBBBBBBBBB')); await flush();
    const accA = await a.accept(last(h.sent));
    h.hub.handle(toAgent(await b.hello(), 'DDDDDDDDDDDDDDDDDDDDDD')); await flush();
    const accB = await b.accept(last(h.sent));
    h.hub.handle(toAgent(accA.confirm, 'BBBBBBBBBBBBBBBBBBBBBB')); await flush();
    h.hub.handle(toAgent(accB.confirm, 'DDDDDDDDDDDDDDDDDDDDDD')); await flush();
    expect(last(h.sent).t).toBe('e2e-reset');
    expect(listDevices()).toHaveLength(1);
    expect(h.hub.peers.size).toBe(1);
  });

  it('refuses after the window', async () => {
    const h = await passkeySetup(BOX, tofuWindow(Date.now() - TOFU_WINDOW_MS - 1));
    const d = new DeviceHandshake(await deviceKeys(), [], null, { tofu: true });
    h.hub.handle(toAgent(await d.hello())); await flush();
    expect(last(h.sent).t).toBe('e2e-unknown-device');
  });

  it('refuses when a device is already enrolled', async () => {
    const h = await passkeySetup(BOX, open30());
    await enroll(h as unknown as Awaited<ReturnType<typeof setup>>, await deviceKeys());
    const d = new DeviceHandshake(await deviceKeys(), [], null, { tofu: true });
    h.hub.handle(toAgent(await d.hello())); await flush();
    expect(last(h.sent).t).toBe('e2e-unknown-device');
  });

  it('stays shut after the first device even if the list empties again', async () => {
    const w = open30();
    const h = await passkeySetup(BOX, w);
    const first = await deviceKeys();
    await sealedTofu(h, first);
    revokeDevice(toB64(first.pub));
    const again = await passkeySetup(BOX, w);
    const d = new DeviceHandshake(await deviceKeys(), [], null, { tofu: true });
    again.hub.handle(toAgent(await d.hello())); await flush();
    expect(last(again.sent).t).toBe('e2e-unknown-device');
  });

  it('stays shut while a pre-authorization is pending', async () => {
    const h = await passkeySetup(BOX, open30());
    const pk = await passkeyDevice();
    storePreauth((await newDeviceCode(pk.pub)).code);
    const d = new DeviceHandshake(await deviceKeys(), [], null, { tofu: true });
    h.hub.handle(toAgent(await d.hello())); await flush();
    expect(last(h.sent).t).toBe('e2e-unknown-device');
    expect(listDevices()).toHaveLength(0);
  });

  it('shuts at the migration cutoff even for an agent started just before it', async () => {
    expect(tofuWindow(TOFU_UNTIL - 60_000).until).toBeLessThanOrEqual(TOFU_UNTIL);
    const h = await passkeySetup(BOX, tofuWindow(TOFU_UNTIL - 60_000));
    const d = new DeviceHandshake(await deviceKeys(), [], null, { tofu: true });
    const hello = await d.hello();
    const now = vi.spyOn(Date, 'now').mockReturnValue(TOFU_UNTIL + 1);
    try {
      h.hub.handle(toAgent(hello)); await flush();
    } finally { now.mockRestore(); }
    expect(last(h.sent).t).toBe('e2e-unknown-device');
  });

  it('an unreadable device list counts as devices and is never overwritten by first use', async () => {
    const { writeFileSync, readFileSync } = await import('node:fs');
    const file = join(process.env.DECK_AGENT_DIR!, 'devices.json');
    writeFileSync(file, '[{"pub":"half-writ');
    const h = await passkeySetup(BOX, open30());
    const d = new DeviceHandshake(await deviceKeys(), [], null, { tofu: true });
    h.hub.handle(toAgent(await d.hello())); await flush();
    expect(last(h.sent).t).toBe('e2e-unknown-device');
    expect(trustFirstDevice((await deviceKeys()).pub, 'x')).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe('[{"pub":"half-writ');
    writeFileSync(file, '{"not":"a list"}');
    expect(trustFirstDevice((await deviceKeys()).pub, 'x')).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe('{"not":"a list"}');
  });

  it('a missing device list is empty and opens first use', async () => {
    const h = await passkeySetup(BOX, open30());
    await sealedTofu(h, await deviceKeys());
    expect(listDevices()).toHaveLength(1);
  });

  it('is off with DECK_E2E_TOFU=off', () => {
    expect(tofuWindow(Date.now(), { DECK_E2E_TOFU: 'off' }).until).toBe(0);
    expect(tofuWindow(1000, {}).until).toBe(1000 + TOFU_WINDOW_MS);
  });

  it('a browser with a pin for the box rejects tofu:true for any other key', async () => {
    const h = await passkeySetup(BOX, open30());
    const dev = await deviceKeys();
    const d = new DeviceHandshake(dev, [randomBytes(32)], null, { tofu: true });
    h.hub.handle(toAgent(await d.hello())); await flush();
    expect(last(h.sent).tofu).toBe(true);
    await expect(d.accept(last(h.sent))).rejects.toMatchObject({ kind: 'mismatch' });
  });

  it('a browser not asking for first use treats tofu:true as unverified', async () => {
    const h = await passkeySetup(BOX, open30());
    const d = new DeviceHandshake(await deviceKeys(), []);
    h.hub.handle(toAgent(await d.hello())); await flush();
    await expect(d.accept(last(h.sent))).rejects.toBeInstanceOf(AgentKeyError);
  });

  async function sealedTofu(h: PSetup, dev: DeviceKeys) {
    const d = new DeviceHandshake(dev, [], null, { tofu: true });
    h.hub.handle(toAgent(await d.hello())); await flush();
    const accepted = await d.accept(last(h.sent));
    h.hub.handle(toAgent(accepted.confirm)); await flush();
    return accepted;
  }
});

describe('device management frames', () => {
  it('a busy device list answers device-pinned ok:false and keeps the channel open', async () => {
    const h = await passkeySetup();
    const dev = await passkeyDevice();
    const agentPub = await enroll(h as unknown as Awaited<ReturnType<typeof setup>>, dev.keys);
    const s = await sealed(h, dev.keys, [agentPub]);
    const { writeFileSync, rmSync } = await import('node:fs');
    const lock = join(process.env.DECK_AGENT_DIR!, 'devices.json.lock');
    writeFileSync(lock, '');
    try {
      await sendSealed(h, s.channel, { t: 'device-pin', box: BOX, key: toB64(await boxPinKey(dev.pinRoot, BOX)) });
      await new Promise((r) => setTimeout(r, 700));
    } finally { rmSync(lock, { force: true }); }
    expect(await lastSealed(h, s.channel)).toMatchObject({ t: 'device-pinned', ok: false });
    expect(h.hub.peers.size).toBe(1);
    await sendSealed(h, s.channel, { t: 'device-pin', box: BOX, key: toB64(await boxPinKey(dev.pinRoot, BOX)) });
    expect(await lastSealed(h, s.channel)).toMatchObject({ t: 'device-pinned', ok: true });
  });

  it('an enrolled device adds its passkey key for this box, and the synced browser then opens by proof', async () => {
    const h = await passkeySetup();
    const random = await deviceKeys();
    const agentPub = await enroll(h as unknown as Awaited<ReturnType<typeof setup>>, random);
    const s = await sealed(h, random, [agentPub]);
    const pk = await passkeyDevice();
    await sendSealed(h, s.channel, { t: 'device-add-passkey', pub: toB64(pk.pub), label: 'Mac · Chrome', box: BOX, key: toB64(await boxPinKey(pk.pinRoot, BOX)) });
    expect(await lastSealed(h, s.channel)).toMatchObject({ t: 'device-passkey-added', ok: true });
    const synced = await passkeyDevice();
    const accepted = await sealWithPin(h, synced.keys, [], checker(synced.pinRoot, BOX, synced.pub));
    expect(accepted.hasPin).toBe(true);
    expect(accepted.agentPub).toEqual(h.keys.pub);
  });

  it('a revoked passkey key is not re-added by another enrolled device until an enroll code clears it', async () => {
    const h = await passkeySetup();
    const random = await deviceKeys();
    const agentPub = await enroll(h as unknown as Awaited<ReturnType<typeof setup>>, random);
    const s = await sealed(h, random, [agentPub]);
    const pk = await passkeyDevice();
    const add = async () => sendSealed(h, s.channel, { t: 'device-add-passkey', pub: toB64(pk.pub), label: 'Mac', box: BOX, key: toB64(await boxPinKey(pk.pinRoot, BOX)) });
    await add();
    expect(await lastSealed(h, s.channel)).toMatchObject({ t: 'device-passkey-added', ok: true });
    revokeDevice(toB64(pk.pub));
    await add();
    expect(await lastSealed(h, s.channel)).toMatchObject({ t: 'device-passkey-added', ok: false });
    expect(listDevices().map((d) => d.pub)).not.toContain(toB64(pk.pub));
    expect(devicePin(toB64(pk.pub))).toBeNull();
    const { code } = await createEnrollCode(h.keys.pub);
    h.hub.handle(toAgent((await enrollRequest(code, pk.pub, 'Mac')).frame, 'EEEEEEEEEEEEEEEEEEEEEE')); await flush();
    await add();
    expect(await lastSealed(h, s.channel)).toMatchObject({ t: 'device-passkey-added', ok: true });
  });

  it('a revoked device never gets back in on first use', async () => {
    const h = await passkeySetup(BOX, tofuWindow(Date.now()));
    const dev = await deviceKeys();
    const { code } = await createEnrollCode(h.keys.pub);
    h.hub.handle(toAgent((await enrollRequest(code, dev.pub, 'a')).frame)); await flush();
    revokeDevice(toB64(dev.pub));
    expect(trustFirstDevice(dev.pub, 'a')).toBe(false);
    expect(listDevices()).toHaveLength(0);
  });

  it('refuses a passkey key named for another box', async () => {
    const h = await passkeySetup();
    const random = await deviceKeys();
    const agentPub = await enroll(h as unknown as Awaited<ReturnType<typeof setup>>, random);
    const s = await sealed(h, random, [agentPub]);
    const pk = await passkeyDevice();
    await sendSealed(h, s.channel, { t: 'device-add-passkey', pub: toB64(pk.pub), label: 'x', box: OTHER_BOX, key: toB64(await boxPinKey(pk.pinRoot, OTHER_BOX)) });
    expect(await lastSealed(h, s.channel)).toMatchObject({ t: 'device-passkey-added', ok: false });
    expect(listDevices()).toHaveLength(1);
  });
});
