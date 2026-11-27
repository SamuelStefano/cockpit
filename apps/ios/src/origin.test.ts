import { describe, expect, it } from 'vitest';
import {
  ALLOWED_HOSTS, DEFAULT_WEB_ORIGIN, isBundleScheme, navigationDecision, originOf, parseWebOrigin, resolveShellOrigin,
} from './origin';

const APP = 'https://deck.devfellowship.com';
const BUNDLE = 'deck://localhost';
const ok = { scheme: 'deck', installed: true, bundlePresent: true };

describe('originOf', () => {
  it('normalises case, default port, trailing dot and user info', () => {
    expect(originOf('HTTPS://Deck.DevFellowship.com:443/x?y#z')).toBe(APP);
    expect(originOf('https://deck.devfellowship.com./')).toBe(APP);
    expect(originOf('https://user:pw@deck.devfellowship.com/')).toBe(APP);
    expect(originOf('https://deck.devfellowship.com:8443/')).toBe('https://deck.devfellowship.com:8443');
    expect(originOf('deck://localhost/auth')).toBe(BUNDLE);
  });
  it('returns null for a non hierarchical URL', () => {
    expect(originOf('mailto:a@b.c')).toBeNull();
    expect(originOf('nonsense')).toBeNull();
  });
});

describe('parseWebOrigin', () => {
  it('defaults to production and refuses non-origins', () => {
    expect(parseWebOrigin(undefined)).toBe(DEFAULT_WEB_ORIGIN);
    expect(() => parseWebOrigin('http://deck.devfellowship.com')).toThrow(/https/);
    expect(() => parseWebOrigin('https://deck.devfellowship.com/app')).toThrow(/no path/);
    expect(() => parseWebOrigin('deck://localhost')).toThrow();
  });
});

describe('isBundleScheme', () => {
  it('accepts deck and refuses reserved schemes', () => {
    expect(isBundleScheme('deck')).toBe(true);
    expect(isBundleScheme('https')).toBe(false);
    expect(isBundleScheme('Deck')).toBe(false);
    expect(isBundleScheme(1)).toBe(false);
  });
});

describe('resolveShellOrigin', () => {
  it('uses https as is', () => {
    expect(resolveShellOrigin(APP, APP, null)).toEqual({ origin: APP, publicOrigin: APP, bundled: false });
  });
  it('uses the bundle only when the native module agrees', () => {
    expect(resolveShellOrigin(BUNDLE, APP, ok)).toEqual({ origin: BUNDLE, publicOrigin: APP, bundled: true });
  });
  it.each([
    ['no module', null, /no DflWebBundle/],
    ['other scheme', { ...ok, scheme: 'other' }, /DflWebBundleScheme is other/],
    ['not installed', { ...ok, installed: false, detail: 'x' }, /not installed \(x\)/],
    ['no bundle', { ...ok, bundlePresent: false }, /index\.html/],
  ])('falls back to https: %s', (_n, native, re) => {
    const r = resolveShellOrigin(BUNDLE, APP, native);
    expect(r.origin).toBe(APP);
    expect(r.bundled).toBe(false);
    expect(r.fallback).toMatch(re);
  });
  it('throws for another host or a path', () => {
    expect(() => resolveShellOrigin('deck://evil', APP, ok)).toThrow();
    expect(() => resolveShellOrigin('ftp://localhost', APP, ok)).toThrow();
  });
});

describe('navigationDecision', () => {
  it.each([APP, `${APP}/chat/1?x=1`, ...ALLOWED_HOSTS.map((h) => `https://${h}/auth/v1/callback`)])('loads %s', (u) => {
    expect(navigationDecision(u, APP, true)).toBe('load');
  });
  it('loads the bundle origin when it is the app origin, and treats the public URL as external', () => {
    expect(navigationDecision('deck://localhost/dashboard', BUNDLE, true)).toBe('load');
    expect(navigationDecision(APP, BUNDLE, true)).toBe('external');
  });
  it.each([
    'https://example.com', 'http://deck.devfellowship.com', 'https://deck.devfellowship.com.evil.com',
    'https://evil.com/deck.devfellowship.com', 'https://deck-relay.devfellowship.com:8443/', 'http://deck-relay.devfellowship.com/',
    'https://ikxtdssxmcgipyfpwmar.supabase.co.evil.com', 'mailto:a@b.c', 'tel:123', 'itms-apps://apps.apple.com/x', 'ftp://x.y',
  ])('opens %s outside', (u) => {
    expect(navigationDecision(u, APP, true)).toBe('external');
  });
  it('treats user info tricks as another origin', () => {
    expect(navigationDecision('https://deck.devfellowship.com@evil.com/', APP, true)).toBe('external');
  });
  it('blocks top-frame blob/data/javascript, allows them in sub-frames', () => {
    expect(navigationDecision('blob:https://deck.devfellowship.com/abc', APP, true)).toBe('block');
    expect(navigationDecision('data:text/html,hi', APP, true)).toBe('block');
    expect(navigationDecision('javascript:alert(1)', APP, false)).toBe('block');
    expect(navigationDecision('blob:https://deck.devfellowship.com/abc', APP, false)).toBe('load');
    expect(navigationDecision('about:blank', APP, true)).toBe('load');
  });
  it('blocks a string with no scheme', () => {
    expect(navigationDecision('/relative', APP, true)).toBe('block');
  });
});
