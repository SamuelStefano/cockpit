import { describe, expect, it, vi } from 'vitest';
import {
  ENROLL_LINK_KEY, captureEnrollLink, clearEnrollLink, enrollLinkStep, enrollLinkUrl, fmtCountdown,
  parseCodeFrame, parseEnrollHash, readEnrollLink, type EnrollLink, type LinkContext,
} from './enroll-link';
import { ENROLL_TTL_MS, newEnrollCode } from '../../shared/e2e/enroll';

const BOX = '22222222-2222-4222-8222-222222222222';
const NOW = 1_800_000_000_000;

function store(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

async function link(over: Partial<EnrollLink> = {}): Promise<EnrollLink> {
  const { code } = await newEnrollCode(new Uint8Array(32).fill(7));
  return { code, box: BOX, expiresAt: NOW + ENROLL_TTL_MS, ...over };
}

describe('enroll link URL', () => {
  it('puts the code only in the fragment, never in the path or the query', async () => {
    const l = await link();
    const url = new URL(enrollLinkUrl('https://deck.example', l));
    expect(url.pathname).toBe('/');
    expect(url.search).toBe('');
    expect(url.hash).toContain(l.code);
    expect(parseEnrollHash(url.hash, NOW)).toEqual(l);
  });

  it('rejects a malformed code, a bad box id or a missing expiry', async () => {
    const l = await link();
    expect(parseEnrollHash(`#enroll=AAAA&box=${BOX}&exp=${NOW}`, NOW)).toBeNull();
    expect(parseEnrollHash(`#enroll=${l.code}&box=../x&exp=${NOW}`, NOW)).toBeNull();
    expect(parseEnrollHash(`#enroll=${l.code}&box=${BOX}`, NOW)).toBeNull();
  });

  it('caps an expiry beyond the code TTL', async () => {
    const l = await link({ expiresAt: NOW + 10 * ENROLL_TTL_MS });
    expect(parseEnrollHash(enrollLinkUrl('https://d', l).split('/')[3]!, NOW)?.expiresAt).toBe(NOW + ENROLL_TTL_MS);
  });
});

describe('captureEnrollLink', () => {
  it('removes the fragment from the address bar and keeps the link for this tab', async () => {
    const l = await link();
    const hash = new URL(enrollLinkUrl('https://d', l)).hash;
    const replaceState = vi.fn();
    const s = store();
    expect(captureEnrollLink({ pathname: '/', search: '?x=1', hash }, { replaceState }, s, NOW)).toEqual(l);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?x=1');
    expect(readEnrollLink(s, NOW)).toEqual(l);
  });

  it('removes even a malformed code from the address bar, storing nothing', () => {
    const replaceState = vi.fn();
    const s = store();
    expect(captureEnrollLink({ pathname: '/', search: '', hash: '#enroll=nope' }, { replaceState }, s, NOW)).toBeNull();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(s.m.size).toBe(0);
  });

  it('leaves any other fragment alone', () => {
    const replaceState = vi.fn();
    expect(captureEnrollLink({ pathname: '/painel', search: '', hash: '#usuarios' }, { replaceState }, store(), NOW)).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('drops a tampered stored link and clears on demand', async () => {
    const s = store({ [ENROLL_LINK_KEY]: '{"code":"x","box":"y","expiresAt":1}' });
    expect(readEnrollLink(s, NOW)).toBeNull();
    expect(s.m.size).toBe(0);
    const l = await link();
    s.setItem(ENROLL_LINK_KEY, JSON.stringify(l));
    clearEnrollLink(s);
    expect(readEnrollLink(s, NOW)).toBeNull();
  });
});

describe('enrollLinkStep', () => {
  const ctx = (over: Partial<LinkContext> = {}): LinkContext => ({ seal: 'enroll', active: BOX, boxes: [BOX], now: NOW, ...over });

  it('runs only once the socket is bound to the link box and asks for enrollment', async () => {
    const l = await link();
    expect(enrollLinkStep(null, ctx())).toBe('idle');
    expect(enrollLinkStep(l, ctx())).toBe('run');
    expect(enrollLinkStep(l, ctx({ seal: 'rejected' }))).toBe('run');
    expect(enrollLinkStep(l, ctx({ seal: 'connecting' }))).toBe('wait');
    expect(enrollLinkStep(l, ctx({ active: '44444444-4444-4444-8444-444444444444' }))).toBe('wait');
    expect(enrollLinkStep(l, ctx({ boxes: null }))).toBe('run');
  });

  it('refuses a box missing from the account and an expired link', async () => {
    const l = await link();
    expect(enrollLinkStep(l, ctx({ boxes: ['44444444-4444-4444-8444-444444444444'] }))).toBe('wrong-box');
    expect(enrollLinkStep(l, ctx({ now: l.expiresAt }))).toBe('expired');
  });

  it('is done when this device is already in', async () => {
    expect(enrollLinkStep(await link(), ctx({ seal: 'sealed' }))).toBe('done');
  });
});

describe('device code frame and countdown', () => {
  it('parses only a well-formed device-code frame', () => {
    expect(parseCodeFrame({ t: 'device-code', code: 'AB', expiresAt: 5 })).toEqual({ code: 'AB', expiresAt: 5 });
    expect(parseCodeFrame({ t: 'device-code', code: 1, expiresAt: 5 })).toBeNull();
    expect(parseCodeFrame({ t: 'devices', code: 'AB', expiresAt: 5 })).toBeNull();
  });

  it('formats the remaining time', () => {
    expect(fmtCountdown(ENROLL_TTL_MS)).toBe('10:00');
    expect(fmtCountdown(61_001)).toBe('1:02');
    expect(fmtCountdown(-5)).toBe('0:00');
  });
});
