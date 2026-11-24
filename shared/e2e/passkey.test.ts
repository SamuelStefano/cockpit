import { describe, expect, it } from 'vitest';
import { boxPinKey, checkPinProof, deriveFromPrf, pinProof } from './passkey';
import { publicRaw } from './channel';
import { randomBytes, type Bytes } from './bytes';

const hex = (b: Bytes) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const PRF = new Uint8Array(32).map((_, i) => i);
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('passkey-derived device key', () => {
  it('derives the same device key and box pin key from the same PRF output (fixed vector)', async () => {
    const one = await deriveFromPrf(PRF);
    const two = await deriveFromPrf(new Uint8Array(PRF));
    expect(hex(one.pub)).toBe('8d6bb0bbf73b04941b3d2af8532fbec6feaf2ed49f92e2de45dcf3f4b5e4d5d5');
    expect(two.pub).toEqual(one.pub);
    expect(hex(await boxPinKey(one.pinRoot, A))).toBe('2de74e29d0de66c3a17212e5e500c5b56557f63a13ba42e8ecdaebf9b52a48f2');
    expect(await boxPinKey(two.pinRoot, A.toUpperCase())).toEqual(await boxPinKey(one.pinRoot, A));
  });

  it('keeps the private key and the pin root non-extractable', async () => {
    const d = await deriveFromPrf(PRF);
    expect(d.pair.privateKey.extractable).toBe(false);
    expect(d.pinRoot.extractable).toBe(false);
    expect(await publicRaw(d.pair.publicKey)).toEqual(d.pub);
    const msg = new Uint8Array([1, 2, 3]);
    const sig = await crypto.subtle.sign({ name: 'Ed25519' }, d.pair.privateKey, msg);
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, d.pair.publicKey, sig, msg)).toBe(true);
  });

  it('gives each box its own pin key and other PRF outputs other keys', async () => {
    const d = await deriveFromPrf(PRF);
    const other = await deriveFromPrf(randomBytes(32));
    expect(await boxPinKey(d.pinRoot, A)).not.toEqual(await boxPinKey(d.pinRoot, B));
    expect(other.pub).not.toEqual(d.pub);
    expect(await boxPinKey(other.pinRoot, A)).not.toEqual(await boxPinKey(d.pinRoot, A));
  });

  it('rejects a PRF output of the wrong size', async () => {
    await expect(deriveFromPrf(new Uint8Array(16))).rejects.toThrow();
  });
});

describe('agent pin proof', () => {
  it('verifies only for the same box, agent key and device key', async () => {
    const d = await deriveFromPrf(PRF);
    const key = await boxPinKey(d.pinRoot, A);
    const agent = randomBytes(32), otherAgent = randomBytes(32);
    const proof = await pinProof(key, agent, d.pub, A);
    expect(await checkPinProof(key, proof, agent, d.pub, A)).toBe(true);
    expect(await checkPinProof(key, proof, otherAgent, d.pub, A)).toBe(false);
    expect(await checkPinProof(key, proof, agent, randomBytes(32), A)).toBe(false);
    expect(await checkPinProof(key, proof, agent, d.pub, B)).toBe(false);
    expect(await checkPinProof(await boxPinKey(d.pinRoot, B), proof, agent, d.pub, B)).toBe(false);
    expect(await checkPinProof(key, randomBytes(32), agent, d.pub, A)).toBe(false);
  });

  it('a compromised box cannot prove another box: its key does not verify there', async () => {
    const d = await deriveFromPrf(PRF);
    const keyA = await boxPinKey(d.pinRoot, A);
    const agent = randomBytes(32);
    const forged = await pinProof(keyA, agent, d.pub, B);
    expect(await checkPinProof(await boxPinKey(d.pinRoot, B), forged, agent, d.pub, B)).toBe(false);
  });
});
