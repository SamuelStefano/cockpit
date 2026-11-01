// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { resolveAppOrigin, CANONICAL_ORIGIN } from './origin';
import { resolveWsUrl, DEFAULT_RELAY_WS } from '../cockpit/session';

describe('resolveAppOrigin', () => {
  it('keeps location.origin in a browser (web behaviour unchanged)', () => {
    expect(resolveAppOrigin({ protocol: 'https:', origin: 'https://deck.devfellowship.com' }, undefined)).toBe('https://deck.devfellowship.com');
    expect(resolveAppOrigin({ protocol: 'http:', origin: 'http://localhost:5173' }, '')).toBe('http://localhost:5173');
  });
  it('uses the canonical https origin on a custom scheme', () => {
    expect(resolveAppOrigin({ protocol: 'app:', origin: 'null' }, undefined)).toBe(CANONICAL_ORIGIN);
    expect(resolveAppOrigin(undefined, undefined)).toBe(CANONICAL_ORIGIN);
  });
  it('lets the build env pick the origin, https only, path dropped', () => {
    expect(resolveAppOrigin({ protocol: 'app:', origin: 'null' }, 'https://deck.example.com/x')).toBe('https://deck.example.com');
    expect(resolveAppOrigin({ protocol: 'app:', origin: 'null' }, 'http://evil.test')).toBe(CANONICAL_ORIGIN);
    expect(resolveAppOrigin({ protocol: 'app:', origin: 'null' }, 'javascript:alert(1)')).toBe(CANONICAL_ORIGIN);
  });
});

describe('resolveWsUrl', () => {
  it('prefers the env value', () => {
    expect(resolveWsUrl(' wss://r.example/ws ', { protocol: 'https:', host: 'x' })).toBe('wss://r.example/ws');
  });
  it('falls back to the same host in a browser', () => {
    expect(resolveWsUrl('', { protocol: 'https:', host: 'deck.dev' })).toBe('wss://deck.dev/ws');
    expect(resolveWsUrl(undefined, { protocol: 'http:', host: 'localhost:5173' })).toBe('ws://localhost:5173/ws');
  });
  it('uses the production relay when there is no host to fall back to', () => {
    expect(resolveWsUrl(undefined, { protocol: 'app:', host: '' })).toBe(DEFAULT_RELAY_WS);
  });
});
