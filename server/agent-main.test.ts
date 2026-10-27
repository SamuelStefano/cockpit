import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import { generateIdentityKeys, signChallenge, challengeMessage, backoffMs, canvasLoopGate, installCrashBackstop } from './agent-main';
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

describe('canvasLoopGate', () => {
  it('runs the liveness scan only with a browser present and a canvas client', () => {
    expect(canvasLoopGate(() => true, () => true)()).toBe(true);
    expect(canvasLoopGate(() => false, () => true)()).toBe(false); // relay said no-browsers
    expect(canvasLoopGate(() => true, () => false)()).toBe(false);
  });
});

describe('installCrashBackstop', () => {
  it('turns an uncaught throw or rejection into a clean shutdown with exit code 1', () => {
    const proc = new EventEmitter();
    const codes: number[] = [];
    const err = console.error;
    console.error = () => {};
    installCrashBackstop(proc, (c) => codes.push(c));
    proc.emit('uncaughtException', new Error('boom'));
    proc.emit('unhandledRejection', new Error('late'));
    console.error = err;
    expect(codes).toEqual([1, 1]);
  });
});

describe('redialWaitMs', () => {
  it('waits long for a revoked/unknown agent and for an old relay holding the slot', async () => {
    const { redialWaitMs, UNKNOWN_AGENT_WAIT_MS, ANOTHER_AGENT_WAIT_MS } = await import('./agent-main');
    expect(redialWaitMs(4401, 'unknown agent', 0)).toBe(UNKNOWN_AGENT_WAIT_MS);
    expect(redialWaitMs(4409, 'another agent online', 0)).toBe(ANOTHER_AGENT_WAIT_MS);
  });

  it('keeps the normal backoff for anything else, a bad signature included', async () => {
    const { redialWaitMs } = await import('./agent-main');
    expect(redialWaitMs(4401, 'bad sig', 2)).toBe(backoffMs(2));
    expect(redialWaitMs(1006, '', 0)).toBe(1_000);
  });
});

describe('boxLabel', () => {
  it('uses DECK_BOX_LABEL and falls back to the hostname', async () => {
    const { boxLabel } = await import('./agent-main');
    const { hostname } = await import('node:os');
    expect(boxLabel({ DECK_BOX_LABEL: '  PC casa ' })).toBe('PC casa');
    expect(boxLabel({ DECK_BOX_LABEL: '  ' })).toBe(hostname());
    expect(boxLabel({})).toBe(hostname());
  });
});
