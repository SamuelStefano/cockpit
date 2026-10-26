import { describe, expect, it } from 'vitest';
import { SealedChannel, newEphemeral, newNonce, publicRaw, signTranscript, verifyTranscript, type Transcript } from './channel';
import { checkGrant, checkRequest, grantMac, newEnrollCode, parseEnrollCode, requestMac } from './enroll';
import { fingerprint } from './channel';

async function signer() {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']) as CryptoKeyPair;
  return { pair, pub: await publicRaw(pair.publicKey) };
}

async function handshake() {
  const agent = await signer();
  const device = await signer();
  const eB = await newEphemeral();
  const eA = await newEphemeral();
  const t: Transcript = { devicePub: device.pub, agentPub: agent.pub, eB: eB.pub, nB: newNonce(), eA: eA.pub, nA: newNonce() };
  const sigA = await signTranscript('agent', agent.pair.privateKey, t);
  const sigB = await signTranscript('device', device.pair.privateKey, t);
  const a = await SealedChannel.derive('agent', eA, eB.pub, t);
  const b = await SealedChannel.derive('device', eB, eA.pub, t);
  return { agent, device, t, sigA, sigB, a, b, eA, eB };
}

describe('handshake signatures', () => {
  it('verifies each role against the pinned key', async () => {
    const h = await handshake();
    expect(await verifyTranscript('agent', h.agent.pub, h.sigA, h.t)).toBe(true);
    expect(await verifyTranscript('device', h.device.pub, h.sigB, h.t)).toBe(true);
  });

  it('rejects the agent signature replayed as the device one', async () => {
    const h = await handshake();
    expect(await verifyTranscript('device', h.agent.pub, h.sigA, h.t)).toBe(false);
  });

  it('rejects a relay that swaps the ephemeral key', async () => {
    const h = await handshake();
    const mitm = await newEphemeral();
    expect(await verifyTranscript('agent', h.agent.pub, h.sigA, { ...h.t, eA: mitm.pub })).toBe(false);
  });

  it('rejects a key the relay made up', async () => {
    const h = await handshake();
    const relay = await signer();
    const forged = await signTranscript('agent', relay.pair.privateKey, h.t);
    expect(await verifyTranscript('agent', h.agent.pub, forged, h.t)).toBe(false);
  });
});

describe('sealed channel', () => {
  it('round-trips both ways', async () => {
    const { a, b } = await handshake();
    expect(await a.open(await b.seal('{"t":"send"}'))).toBe('{"t":"send"}');
    expect(await b.open(await a.seal('{"t":"delta"}'))).toBe('{"t":"delta"}');
  });

  it('tolerates a dropped frame but refuses replay and reorder', async () => {
    const { a, b } = await handshake();
    const f1 = await b.seal('one');
    const f2 = await b.seal('two');
    const f3 = await b.seal('three');
    expect(await a.open(f2)).toBe('two');
    await expect(a.open(f1)).rejects.toThrow();
    await expect(a.open(f2)).rejects.toThrow();
    expect(await a.open(f3)).toBe('three');
  });

  it('refuses a tampered payload or a bumped sequence', async () => {
    const { a, b } = await handshake();
    const f = await b.seal('term-open');
    const bytes = Uint8Array.from(atob(f.d), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    await expect(a.open({ s: f.s, d: btoa(String.fromCharCode(...bytes)) })).rejects.toThrow();
    await expect(a.open({ s: f.s + 1, d: f.d })).rejects.toThrow();
    expect(await a.open(f)).toBe('term-open');
  });

  it('refuses a frame reflected back to its sender', async () => {
    const { b } = await handshake();
    await expect(b.open(await b.seal('x'))).rejects.toThrow();
  });

  it('refuses a frame from another session', async () => {
    const one = await handshake();
    const two = await handshake();
    await expect(one.a.open(await two.b.seal('x'))).rejects.toThrow();
  });

  it('rejects non-numeric or unsafe sequences', async () => {
    const { a, b } = await handshake();
    const f = await b.seal('x');
    await expect(a.open({ s: '1', d: f.d })).rejects.toThrow();
    await expect(a.open({ s: 2 ** 60, d: f.d })).rejects.toThrow();
  });
});

describe('enrollment', () => {
  it('pins the agent key and binds the device key', async () => {
    const agent = await signer();
    const device = await signer();
    const { code, secret } = await newEnrollCode(agent.pub);
    const parsed = parseEnrollCode(code);
    expect(parsed.secret).toEqual(secret);
    const mac = await requestMac(parsed.secret, device.pub, parsed.agentFp, 'phone');
    expect(await checkRequest(secret, agent.pub, device.pub, 'phone', mac)).toBe(true);
    const grant = await grantMac(secret, agent.pub, device.pub);
    expect(await checkGrant(parsed, agent.pub, device.pub, grant)).toBe(true);
  });

  it('rejects a relay that swaps the device key', async () => {
    const agent = await signer();
    const device = await signer();
    const relay = await signer();
    const { code, secret } = await newEnrollCode(agent.pub);
    const parsed = parseEnrollCode(code);
    const mac = await requestMac(parsed.secret, device.pub, parsed.agentFp, 'phone');
    expect(await checkRequest(secret, agent.pub, relay.pub, 'phone', mac)).toBe(false);
  });

  it('rejects a relay that answers with its own agent key', async () => {
    const agent = await signer();
    const device = await signer();
    const relay = await signer();
    const { code } = await newEnrollCode(agent.pub);
    const parsed = parseEnrollCode(code);
    const forged = await grantMac(new Uint8Array(16), relay.pub, device.pub);
    expect(await checkGrant(parsed, relay.pub, device.pub, forged)).toBe(false);
  });

  it('accepts the code with spacing and lower case', async () => {
    const agent = await signer();
    const { code } = await newEnrollCode(agent.pub);
    const parsed = parseEnrollCode(` ${code.toLowerCase().replace(/-/g, ' ')} `);
    expect(parsed.agentFp).toEqual(await fingerprint(agent.pub));
  });

  it('rejects a truncated code', () => {
    expect(() => parseEnrollCode('ABCD-EFGH')).toThrow();
  });
});
