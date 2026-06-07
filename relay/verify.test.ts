import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { validateClaims, verifyAgentSignature, makeChallenge } from './src/verify';
import { parseRootEmails } from '../shared/identity';

const ISS = 'https://proj.supabase.co/auth/v1';
const NOW = 1_800_000_000;

describe('validateClaims', () => {
  const roots = parseRootEmails('boss@dfl.com');
  const base = { iss: ISS, sub: 'uid-1', email: 'alice@dfl.com', aud: 'authenticated', exp: NOW + 3600 };

  it('accepts a well-formed token and resolves the account role', () => {
    const id = validateClaims(base, { iss: ISS, nowSec: NOW, rootEmails: roots, isAdmin: false });
    expect(id).toEqual({ accountId: 'uid-1', email: 'alice@dfl.com', role: 'fellow' });
  });

  it('derives root from the env allowlist', () => {
    const id = validateClaims({ ...base, email: 'boss@dfl.com' }, { iss: ISS, nowSec: NOW, rootEmails: roots, isAdmin: false });
    expect(id?.role).toBe('root');
  });

  it('rejects a wrong issuer', () => {
    expect(validateClaims({ ...base, iss: 'https://evil/' }, { iss: ISS, nowSec: NOW, rootEmails: roots, isAdmin: false })).toBeNull();
  });

  it('rejects a missing authenticated audience', () => {
    expect(validateClaims({ ...base, aud: 'anon' }, { iss: ISS, nowSec: NOW, rootEmails: roots, isAdmin: false })).toBeNull();
  });

  it('rejects an expired token', () => {
    expect(validateClaims({ ...base, exp: NOW - 1 }, { iss: ISS, nowSec: NOW, rootEmails: roots, isAdmin: false })).toBeNull();
  });

  it('rejects a token missing sub or email', () => {
    expect(validateClaims({ ...base, sub: undefined }, { iss: ISS, nowSec: NOW, rootEmails: roots, isAdmin: false })).toBeNull();
    expect(validateClaims({ ...base, email: undefined }, { iss: ISS, nowSec: NOW, rootEmails: roots, isAdmin: false })).toBeNull();
  });

  it('accepts an array audience that includes authenticated', () => {
    const id = validateClaims({ ...base, aud: ['authenticated', 'other'] }, { iss: ISS, nowSec: NOW, rootEmails: roots, isAdmin: false });
    expect(id?.accountId).toBe('uid-1');
  });
});

describe('verifyAgentSignature (Ed25519)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const challenge = makeChallenge();
  const sigB64 = edSign(null, Buffer.from(challenge), privateKey).toString('base64');

  it('accepts a valid signature over the challenge', () => {
    expect(verifyAgentSignature(pubB64, challenge, sigB64)).toBe(true);
  });

  it('rejects a signature over a different challenge', () => {
    expect(verifyAgentSignature(pubB64, makeChallenge(), sigB64)).toBe(false);
  });

  it('rejects a signature from a different key', () => {
    const other = generateKeyPairSync('ed25519');
    const otherSig = edSign(null, Buffer.from(challenge), other.privateKey).toString('base64');
    expect(verifyAgentSignature(pubB64, challenge, otherSig)).toBe(false);
  });

  it('returns false (never throws) on garbage input', () => {
    expect(verifyAgentSignature('not-a-key', challenge, sigB64)).toBe(false);
    expect(verifyAgentSignature(pubB64, challenge, 'not-a-sig')).toBe(false);
  });

  it('makeChallenge yields distinct values', () => {
    expect(makeChallenge()).not.toBe(makeChallenge());
  });
});
