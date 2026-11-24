import { describe, it, expect } from 'vitest';
import { clientIp, originAllowed, tokenFromSubprotocol, pickSubprotocol, makeLimiter, parseCsvSet, rawLength } from './guards';

const req = (remote: string, xff?: string | string[]) => ({ socket: { remoteAddress: remote }, headers: { 'x-forwarded-for': xff } }) as never;

describe('clientIp', () => {
  it('takes the last XFF value when the peer is loopback', () => {
    expect(clientIp(req('127.0.0.1', '6.6.6.6, 9.9.9.9'))).toBe('9.9.9.9');
    expect(clientIp(req('::ffff:127.0.0.1', '9.9.9.9'))).toBe('9.9.9.9');
  });
  it('ignores XFF from a non-loopback peer', () => {
    expect(clientIp(req('203.0.113.5', '1.1.1.1'))).toBe('203.0.113.5');
  });
  it('falls back to the peer when XFF is absent', () => {
    expect(clientIp(req('127.0.0.1'))).toBe('127.0.0.1');
  });
});

describe('originAllowed', () => {
  const allow = parseCsvSet('https://deck.example.com, https://b.example.com');
  it('accepts listed, rejects unlisted, allows missing Origin', () => {
    expect(originAllowed(allow, 'https://deck.example.com')).toBe(true);
    expect(originAllowed(allow, 'https://evil.com')).toBe(false);
    expect(originAllowed(allow, undefined)).toBe(true);
  });
  it('is open when the list is empty', () => {
    expect(originAllowed(new Set(), 'https://evil.com')).toBe(true);
  });
});

describe('subprotocol token', () => {
  it('extracts the bearer entry', () => {
    expect(tokenFromSubprotocol('deck.v1, bearer.abc.def.ghi')).toBe('abc.def.ghi');
    expect(tokenFromSubprotocol(['deck.v1', 'bearer.x'])).toBe('x');
  });
  it('returns null without one', () => {
    expect(tokenFromSubprotocol('deck.v1')).toBeNull();
    expect(tokenFromSubprotocol('bearer.')).toBeNull();
    expect(tokenFromSubprotocol(undefined)).toBeNull();
  });
  it('selects deck.v1 only, never the bearer entry', () => {
    expect(pickSubprotocol(new Set(['deck.v1', 'bearer.x']))).toBe('deck.v1');
    expect(pickSubprotocol(new Set(['bearer.x']))).toBe(false);
  });
});

describe('makeLimiter', () => {
  it('caps and releases once', () => {
    const acquire = makeLimiter(2);
    const a = acquire('ip')!; acquire('ip');
    expect(acquire('ip')).toBeNull();
    expect(acquire('other')).not.toBeNull();
    a(); a();
    expect(acquire('ip')).not.toBeNull();
    expect(acquire('ip')).toBeNull();
  });
});

describe('rawLength', () => {
  it('sums chunks', () => {
    expect(rawLength([Buffer.alloc(3), Buffer.alloc(4)])).toBe(7);
    expect(rawLength(Buffer.alloc(5))).toBe(5);
  });
});
