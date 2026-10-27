import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import type { WebSocket } from 'ws';
import { SealedHub, agentKeysFrom, MAX_CHANNEL_MS, type SealedPeer } from './hub';
import { createEnrollCode, devicePin, listDevices, revokeDevice, storePreauth } from './devices';
import { deviceFrameHandler } from './manage';
import {
  DeviceHandshake, enrollRequest, enrollResult, preauthRequest, preauthResult, type DeviceKeys, type PinCheck,
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

const flush = () => new Promise((r) => setTimeout(r, 30));
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
  return { keys, sent, hub, served, got };
}

async function enroll(h: Awaited<ReturnType<typeof setup>>, dev: DeviceKeys): Promise<Bytes> {
  const { code } = await createEnrollCode(h.keys.pub);
  const { frame, parsed } = await enrollRequest(code, dev.pub, 'phone');
  h.hub.handle(toAgent(frame)); await flush();
  const pinned = await enrollResult(last(h.sent), parsed, dev.pub);
  if (!pinned) throw new Error('enroll failed');
  return pinned;
}

async function open(h: Awaited<ReturnType<typeof setup>>, dev: DeviceKeys, pinned: Bytes[]) {
  const d = new DeviceHandshake(dev, pinned);
  h.hub.handle(toAgent(await d.hello())); await flush();
  const { confirm, channel } = await d.accept(last(h.sent));
  h.hub.handle(toAgent(confirm)); await flush();
  return channel;
}

beforeEach(() => { process.env.DECK_AGENT_DIR = mkdtempSync(join(tmpdir(), 'deck-e2e-')); });

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

async function passkeySetup(boxId = BOX) {
  const keys = await agentKeys();
  const { sent, link } = fakeLink();
  const got: string[] = [];
  let hub: SealedHub | null = null;
  hub = new SealedHub({
    keys, link, onPeersChanged: () => {}, boxId,
    intercept: deviceFrameHandler(keys.pub, () => hub, boxId),
    serve: (p) => { p.on('message', (b: Buffer) => got.push(b.toString())); },
  });
  return { keys, sent, hub, got };
}

async function passkeyDevice(prf = PRF) {
  const d = await deriveFromPrf(prf);
  return { ...d, keys: { pub: d.pub, sign: d.pair.privateKey } as DeviceKeys };
}

type PSetup = Awaited<ReturnType<typeof passkeySetup>>;

async function preauth(h: PSetup, dev: DeviceKeys, secret: Bytes, label = 'Mac · Chrome') {
  h.hub.handle(toAgent(await preauthRequest(secret, dev.pub, label))); await flush();
  return preauthResult(last(h.sent), secret, dev.pub);
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
    const frame = await preauthRequest(secret, dev.keys.pub, 'a');
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
    h.hub.handle(toAgent(await preauthRequest(secret, dev.keys.pub, 'a'))); await flush();
    const forged = { ...last(h.sent), agent: toB64((await agentKeys()).pub) };
    expect(await preauthResult(forged, secret, dev.pub)).toBeNull();
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
    expect(accepted.provedByPin).toBe(true);
    expect(accepted.hasPin).toBe(true);
    expect(accepted.agentPub).toEqual(h.keys.pub);
    expect(h.hub.peers.size).toBe(2);
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
    const frame = await preauthRequest(secret, dev.keys.pub, 'a');
    browserFrames.push(JSON.stringify(frame));
    h.hub.handle(toAgent(frame)); await flush();
    const agentPub = (await preauthResult(last(h.sent), secret, dev.pub))!;
    const key = await boxPinKey(dev.pinRoot, BOX);
    const s = await sealWithPin(h, dev.keys, [agentPub], checker(dev.pinRoot, BOX, dev.pub));
    const f = await s.channel.seal(JSON.stringify({ t: 'device-pin', box: BOX, key: toB64(key) }));
    browserFrames.push(JSON.stringify({ t: 'e2e', ...f }));
    h.hub.handle(toAgent({ t: 'e2e', ...f })); await flush();
    const wire = [...browserFrames, ...h.sent].join('\n');
    for (const secretText of [toB64(key), toB64(secret), toB64(PRF), code]) expect(wire).not.toContain(secretText);
  });
});
