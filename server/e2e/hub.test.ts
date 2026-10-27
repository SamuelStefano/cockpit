import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import type { WebSocket } from 'ws';
import { SealedHub, agentKeysFrom, MAX_CHANNEL_MS, type SealedPeer } from './hub';
import { createEnrollCode, listDevices, revokeDevice } from './devices';
import { DeviceHandshake, enrollRequest, enrollResult, type DeviceKeys } from '../../shared/e2e/device';
import { publicRaw, type KeyPair } from '../../shared/e2e/channel';
import { toB64, type Bytes } from '../../shared/e2e/bytes';

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
