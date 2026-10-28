// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { uaFamily, buildReport, telemetryUrl, sendConnectionReport, resetTelemetryForTests, endOfflineEpisode, MAX_REPORTS_PER_PAGE } from './connectionTelemetry';

const URL_OK = 'https://relay.example.com/telemetry';

describe('uaFamily', () => {
  it('classifies the main browsers', () => {
    expect(uaFamily('Mozilla/5.0 Chrome/120 Safari/537.36')).toBe('chrome');
    expect(uaFamily('Mozilla/5.0 Chrome/120 Safari/537.36 Edg/120')).toBe('edge');
    expect(uaFamily('Mozilla/5.0 Gecko/20100101 Firefox/121.0')).toBe('firefox');
    expect(uaFamily('Mozilla/5.0 (iPhone) AppleWebKit Version/17 Mobile Safari/604.1')).toBe('safari');
    expect(uaFamily('curl/8')).toBe('other');
  });
});

describe('buildReport', () => {
  it('truncates and clamps per contract and drops unknown fields', () => {
    const r = buildReport({ kind: 'ws_offline', closeCode: 1006.4, closeReason: 'x'.repeat(100), offlineMs: -5, app: 'a'.repeat(50), phase: 'bogus' as never, userId: 'u1' } as never);
    expect(r).toEqual({ v: 1, kind: 'ws_offline', closeCode: 1006, closeReason: 'x'.repeat(40), offlineMs: 0, app: 'a'.repeat(24) });
  });
});

describe('telemetryUrl', () => {
  it('maps a remote wss base to the https origin', () => {
    expect(telemetryUrl('wss://relay.example.com/ws')).toBe(URL_OK);
  });
  it('skips loopback and plain ws backends', () => {
    expect(telemetryUrl('ws://relay.example.com/ws')).toBeNull();
    expect(telemetryUrl('wss://localhost:7777/ws')).toBeNull();
    expect(telemetryUrl('wss://127.0.0.1/ws')).toBeNull();
    expect(telemetryUrl('wss://[::1]/ws')).toBeNull();
    expect(telemetryUrl('garbage')).toBeNull();
  });
});

describe('sendConnectionReport', () => {
  const beacon = vi.fn((_u: string, _b: Blob) => true);
  beforeEach(() => {
    resetTelemetryForTests();
    beacon.mockClear();
    Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon: beacon }, configurable: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('beacons text/plain JSON', async () => {
    expect(sendConnectionReport(buildReport({ kind: 'auth_rejected', closeCode: 4401 }), URL_OK)).toBe(true);
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe(URL_OK);
    expect(blob.type).toBe('text/plain');
    expect(JSON.parse(await blob.text())).toEqual({ v: 1, kind: 'auth_rejected', closeCode: 4401 });
  });

  it('falls back to keepalive fetch and swallows errors', () => {
    Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon: () => false }, configurable: true });
    const f = vi.fn(() => Promise.reject(new Error('net')));
    vi.stubGlobal('fetch', f);
    expect(sendConnectionReport(buildReport({ kind: 'ws_recovered' }), URL_OK)).toBe(true);
    expect(f).toHaveBeenCalledWith(URL_OK, expect.objectContaining({ method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' } }));
  });

  it('sends nothing without a url', () => {
    expect(sendConnectionReport(buildReport({ kind: 'ws_offline' }), null)).toBe(false);
    expect(beacon).not.toHaveBeenCalled();
  });

  it('sends one ws_offline per episode', () => {
    const r = buildReport({ kind: 'ws_offline' });
    expect(sendConnectionReport(r, URL_OK)).toBe(true);
    expect(sendConnectionReport(r, URL_OK)).toBe(false);
    endOfflineEpisode();
    expect(sendConnectionReport(r, URL_OK)).toBe(true);
  });

  it('caps reports per page load', () => {
    for (let i = 0; i < MAX_REPORTS_PER_PAGE; i++) expect(sendConnectionReport(buildReport({ kind: 'ws_recovered' }), URL_OK)).toBe(true);
    expect(sendConnectionReport(buildReport({ kind: 'ws_recovered' }), URL_OK)).toBe(false);
  });
});
