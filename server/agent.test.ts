import { describe, it, expect } from 'vitest';
import { generateIdentityKeys, signChallenge, backoffMs } from './agent';
import { verifyAgentSignature, makeChallenge } from '../relay/src/verify';

describe('agent ↔ relay signature contract', () => {
  it('a challenge signed by the agent verifies on the relay', () => {
    const { privateKeyPem, publicKey } = generateIdentityKeys();
    const challenge = makeChallenge();
    const sig = signChallenge(privateKeyPem, challenge);
    expect(verifyAgentSignature(publicKey, challenge, sig)).toBe(true);
  });

  it('a signature does not verify against a different challenge', () => {
    const { privateKeyPem, publicKey } = generateIdentityKeys();
    const sig = signChallenge(privateKeyPem, makeChallenge());
    expect(verifyAgentSignature(publicKey, makeChallenge(), sig)).toBe(false);
  });

  it('one agent key cannot impersonate another', () => {
    const a = generateIdentityKeys();
    const b = generateIdentityKeys();
    const challenge = makeChallenge();
    const sigA = signChallenge(a.privateKeyPem, challenge);
    expect(verifyAgentSignature(b.publicKey, challenge, sigA)).toBe(false);
  });
});

describe('backoffMs', () => {
  it('grows exponentially and caps at 30s', () => {
    expect(backoffMs(0)).toBe(1_000);
    expect(backoffMs(1)).toBe(2_000);
    expect(backoffMs(3)).toBe(8_000);
    expect(backoffMs(5)).toBe(30_000);
    expect(backoffMs(99)).toBe(30_000);
  });
});
