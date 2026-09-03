import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { validateClaims, verifyAgentSignature, makeChallenge, emailVerified } from './verify';
import { parseRootEmails } from '../../shared/identity';

const ISS = 'https://proj.supabase.co/auth/v1';
const NOW = 1_800_000_000;

describe('validateClaims', () => {
  const roots = parseRootEmails('boss@dfl.com');
  // email_verified é pré-requisito dos papéis privilegiados (o cadastro é aberto e o
  // root sai do claim `email`), então a base dos testes já vem verificada.
  const base = { iss: ISS, sub: 'uid-1', email: 'alice@dfl.com', aud: 'authenticated', exp: NOW + 3600, email_verified: true };

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

describe('emailVerified (pré-requisito de papel privilegiado)', () => {
  const roots = parseRootEmails('boss@dfl.com');
  const opts = { iss: ISS, nowSec: NOW, rootEmails: roots, isAdmin: true };
  const base = { iss: ISS, sub: 'uid-1', email: 'boss@dfl.com', aud: 'authenticated', exp: NOW + 3600 };

  it('lê o claim de topo e o do user_metadata (formato do Supabase)', () => {
    expect(emailVerified({ email_verified: true })).toBe(true);
    expect(emailVerified({ user_metadata: { email_verified: true } })).toBe(true);
  });

  it('fail-closed: ausente, string ou tipo errado contam como não verificado', () => {
    expect(emailVerified({})).toBe(false);
    expect(emailVerified({ email_verified: 'true' })).toBe(false);
    expect(emailVerified({ user_metadata: null })).toBe(false);
    expect(emailVerified({ user_metadata: { email_verified: 'yes' } })).toBe(false);
  });

  // O ataque que isto fecha: cadastro aberto + root derivado do email = quem soubesse
  // o email da allowlist virava root sem provar posse da caixa.
  it('sem verificação, o email da allowlist NÃO vira root (cai pra fellow)', () => {
    expect(validateClaims(base, opts)?.role).toBe('fellow');
    expect(validateClaims({ ...base, email_verified: true }, opts)?.role).toBe('root');
  });

  it('sem verificação, a flag is_admin também não eleva', () => {
    expect(validateClaims({ ...base, email: 'alice@dfl.com' }, opts)?.role).toBe('fellow');
    expect(validateClaims({ ...base, email: 'alice@dfl.com', user_metadata: { email_verified: true } }, opts)?.role).toBe('admin');
  });
});
