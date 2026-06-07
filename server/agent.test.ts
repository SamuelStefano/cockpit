import { describe, it, expect } from 'vitest';
import { generateIdentityKeys, signChallenge, challengeMessage, backoffMs } from './agent';
import { verifyAgentSignature, makeChallenge } from '../relay/src/verify';

const AID = 'agent-123';

describe('agent ↔ relay signature contract', () => {
  it('a challenge signed by the agent verifies on the relay (domain-separated)', () => {
    const { privateKeyPem, publicKey } = generateIdentityKeys();
    const challenge = makeChallenge();
    const sig = signChallenge(privateKeyPem, challenge, AID);
    expect(verifyAgentSignature(publicKey, challengeMessage(challenge, AID), sig)).toBe(true);
  });

  it('a signature does not verify against a different challenge', () => {
    const { privateKeyPem, publicKey } = generateIdentityKeys();
    const sig = signChallenge(privateKeyPem, makeChallenge(), AID);
    expect(verifyAgentSignature(publicKey, challengeMessage(makeChallenge(), AID), sig)).toBe(false);
  });

  it('a signature for one agentId does not verify for another (domain separation)', () => {
    const { privateKeyPem, publicKey } = generateIdentityKeys();
    const challenge = makeChallenge();
    const sig = signChallenge(privateKeyPem, challenge, AID);
    expect(verifyAgentSignature(publicKey, challengeMessage(challenge, 'other-agent'), sig)).toBe(false);
  });

  it('one agent key cannot impersonate another', () => {
    const a = generateIdentityKeys();
    const b = generateIdentityKeys();
    const challenge = makeChallenge();
    const sigA = signChallenge(a.privateKeyPem, challenge, AID);
    expect(verifyAgentSignature(b.publicKey, challengeMessage(challenge, AID), sigA)).toBe(false);
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
