import { concat, equalBytes, framed, fromB64, utf8, type Bytes } from './bytes';
import { PROTO, type KeyPair } from './channel';
import { hmac } from './enroll';

// Device key derived from a passkey's PRF output. Every browser the passkey
// syncs to derives the same Ed25519 key, so a box that trusts it once trusts
// them all, and the same output yields `pinRoot`, from which each box gets its
// own pin key. Only what comes after the PRF lives here (WebAuthn itself sits
// in src/cockpit/passkey.ts), so the agent and the tests share this code.

export const PRF_SALT = utf8('deck-e2e-device-v1');

// RFC 8410 PKCS#8 header for an Ed25519 private key; the 32-byte seed follows.
const PKCS8_ED25519 = new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);

const subtle = () => globalThis.crypto.subtle;

export interface PasskeyDevice { pair: KeyPair; pub: Bytes; pinRoot: CryptoKey }

async function expand(base: CryptoKey, info: string): Promise<Bytes> {
  return new Uint8Array(await subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: PRF_SALT, info: utf8(`${PROTO}/passkey/${info}`) }, base, 256,
  ));
}

function fromB64Url(s: string): Bytes {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  return fromB64(std + '='.repeat((4 - (std.length % 4)) % 4));
}

// WebCrypto has no "public key from private key", so the seed is imported once
// as extractable only to read the public half out of its JWK, then imported
// again non-extractable: that second key is the only one that is kept.
export async function deriveFromPrf(prf: Bytes): Promise<PasskeyDevice> {
  if (prf.length !== 32) throw new Error('bad PRF output');
  const base = await subtle().importKey('raw', prf, 'HKDF', false, ['deriveBits']);
  const seed = await expand(base, 'device-sign');
  const root = await expand(base, 'pin-root');
  const pkcs8 = concat(PKCS8_ED25519, seed);
  try {
    const once = await subtle().importKey('pkcs8', pkcs8, { name: 'Ed25519' }, true, ['sign']);
    const { x } = await subtle().exportKey('jwk', once);
    if (!x) throw new Error('no public key');
    const pub = fromB64Url(x);
    const privateKey = await subtle().importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign']);
    const publicKey = await subtle().importKey('raw', pub, { name: 'Ed25519' }, true, ['verify']);
    const pinRoot = await subtle().importKey('raw', root, 'HKDF', false, ['deriveBits']);
    return { pair: { publicKey, privateKey }, pub, pinRoot };
  } finally {
    seed.fill(0); root.fill(0); pkcs8.fill(0);
  }
}

// One key per box: a box only ever learns its own, so a compromised box cannot
// produce a pin proof that another box's dial would accept.
export async function boxPinKey(pinRoot: CryptoKey, boxId: string): Promise<Bytes> {
  return new Uint8Array(await subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: framed(utf8(PROTO), utf8('box-pin'), utf8(boxId.toLowerCase())) },
    pinRoot, 256,
  ));
}

function pinBytes(agentPub: Bytes, devicePub: Bytes, boxId: string): Bytes {
  return framed(utf8(PROTO), utf8('agent-pin'), agentPub, devicePub, utf8(boxId.toLowerCase()));
}

export function pinProof(key: Bytes, agentPub: Bytes, devicePub: Bytes, boxId: string): Promise<Bytes> {
  return hmac(key, pinBytes(agentPub, devicePub, boxId));
}

export async function checkPinProof(key: Bytes, proof: Bytes, agentPub: Bytes, devicePub: Bytes, boxId: string): Promise<boolean> {
  if (key.length !== 32 || proof.length !== 32 || agentPub.length !== 32) return false;
  return equalBytes(proof, await pinProof(key, agentPub, devicePub, boxId));
}
