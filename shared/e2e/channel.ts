import { concat, equalBytes, framed, fromB64, randomBytes, toB64, u64, utf8 } from './bytes';

// Sealed browser↔agent channel (T5). The relay forwards these frames but holds
// none of the keys: it cannot read a frame, forge one, or replay an old one.
// Trust roots are pinned out of band at enrollment (enroll.ts), never learned
// from the relay.

export const PROTO = 'deck-e2e-v1';
const subtle = () => globalThis.crypto.subtle;

export async function importSigningPublic(raw: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey('raw', raw, { name: 'Ed25519' }, true, ['verify']);
}

export async function publicRaw(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await subtle().exportKey('raw', key));
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().digest('SHA-256', data));
}

export async function fingerprint(pubRaw: Uint8Array): Promise<Uint8Array> {
  return (await sha256(concat(utf8(`${PROTO}/fp`), pubRaw))).slice(0, 16);
}

async function sign(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle().sign({ name: 'Ed25519' }, key, data));
}

async function verify(key: CryptoKey, sig: Uint8Array, data: Uint8Array): Promise<boolean> {
  try { return await subtle().verify({ name: 'Ed25519' }, key, sig, data); } catch { return false; }
}

export interface Ephemeral { pair: CryptoKeyPair; pub: Uint8Array }

export async function newEphemeral(): Promise<Ephemeral> {
  const pair = await subtle().generateKey({ name: 'X25519' }, false, ['deriveBits']) as CryptoKeyPair;
  return { pair, pub: await publicRaw(pair.publicKey) };
}

export interface Transcript {
  devicePub: Uint8Array;
  agentPub: Uint8Array;
  eB: Uint8Array; nB: Uint8Array;
  eA: Uint8Array; nA: Uint8Array;
}

// Each signature names its role, so the agent's signature can never be replayed
// as the device's (or the other way round) inside the same transcript.
function transcriptBytes(role: 'agent' | 'device', t: Transcript): Uint8Array {
  return framed(utf8(PROTO), utf8(role), t.devicePub, t.agentPub, t.eB, t.nB, t.eA, t.nA);
}

export async function signTranscript(role: 'agent' | 'device', key: CryptoKey, t: Transcript): Promise<Uint8Array> {
  return sign(key, transcriptBytes(role, t));
}

export async function verifyTranscript(role: 'agent' | 'device', pub: Uint8Array, sig: Uint8Array, t: Transcript): Promise<boolean> {
  if (sig.length !== 64) return false;
  return verify(await importSigningPublic(pub), sig, transcriptBytes(role, t));
}

// Low-order X25519 points give an all-zero secret that the relay could force;
// WebCrypto rejects most of them, this catches the rest.
async function sharedSecret(mine: CryptoKeyPair, theirs: Uint8Array): Promise<Uint8Array> {
  if (theirs.length !== 32) throw new Error('bad ephemeral');
  const peer = await subtle().importKey('raw', theirs, { name: 'X25519' }, false, []);
  const bits = new Uint8Array(await subtle().deriveBits({ name: 'X25519', public: peer }, mine.privateKey, 256));
  if (equalBytes(bits, new Uint8Array(32))) throw new Error('weak shared secret');
  return bits;
}

async function hkdfKey(ikm: Uint8Array, salt: Uint8Array, info: string): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8(`${PROTO}/${info}`) },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

// Past this a channel re-handshakes instead of risking a nonce wrap.
const MAX_SEQ = 2 ** 40;

export class SealedChannel {
  private sendSeq = 0;
  private recvSeq = 0;

  private constructor(
    private readonly sendKey: CryptoKey,
    private readonly recvKey: CryptoKey,
    private readonly sendDir: number,
  ) {}

  static async derive(side: 'agent' | 'device', mine: Ephemeral, theirPub: Uint8Array, t: Transcript): Promise<SealedChannel> {
    const ikm = await sharedSecret(mine.pair, theirPub);
    const salt = await sha256(transcriptBytes('agent', t));
    const toAgent = await hkdfKey(ikm, salt, 'device-to-agent');
    const toDevice = await hkdfKey(ikm, salt, 'agent-to-device');
    return side === 'agent'
      ? new SealedChannel(toDevice, toAgent, 2)
      : new SealedChannel(toAgent, toDevice, 1);
  }

  private nonce(dir: number, seq: number): Uint8Array {
    return concat(new Uint8Array([0, 0, 0, dir]), u64(seq));
  }

  async seal(plaintext: string): Promise<{ s: number; d: string }> {
    const s = ++this.sendSeq;
    if (s >= MAX_SEQ) throw new Error('channel exhausted');
    const iv = this.nonce(this.sendDir, s);
    const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: concat(utf8(PROTO), iv) }, this.sendKey, utf8(plaintext));
    return { s, d: toB64(new Uint8Array(ct)) };
  }

  // Strictly increasing, not strictly consecutive: the relay may drop a
  // high-rate frame under backpressure, but it can never replay or reorder.
  async open(frame: { s: unknown; d: unknown }): Promise<string> {
    const s = frame.s;
    if (typeof s !== 'number' || !Number.isSafeInteger(s) || s <= this.recvSeq || s >= MAX_SEQ) throw new Error('bad sequence');
    if (typeof frame.d !== 'string') throw new Error('bad payload');
    const iv = this.nonce(3 - this.sendDir, s);
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: concat(utf8(PROTO), iv) }, this.recvKey, fromB64(frame.d));
    this.recvSeq = s;
    return new TextDecoder().decode(pt);
  }
}

export function newNonce(): Uint8Array {
  return randomBytes(16);
}

export { toB64, fromB64 };
