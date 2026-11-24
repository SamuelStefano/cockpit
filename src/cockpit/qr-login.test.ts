import { describe, it, expect, vi } from 'vitest';
import { QR_APPROVE_KEY, QR_TICKET_KEY, captureQrLogin, describeUa, pollRequest, readQrKey } from './qr-login';
import { captureEnrollLink } from './enroll-link';

const K = 'a'.repeat(43);
const kv = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };

describe('captureQrLogin', () => {
  it('keeps a valid ticket and approval id and strips the fragment', () => {
    const s = kv(); const hist = { replaceState: vi.fn() };
    captureQrLogin({ pathname: '/', search: '', hash: `#login=${K}&qrlogin=${K}` }, hist, s);
    expect(readQrKey(s, QR_TICKET_KEY)).toBe(K);
    expect(readQrKey(s, QR_APPROVE_KEY)).toBe(K);
    expect(hist.replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('ignores malformed values but still strips them', () => {
    const s = kv(); const hist = { replaceState: vi.fn() };
    captureQrLogin({ pathname: '/', search: '', hash: '#login=short' }, hist, s);
    expect(readQrKey(s, QR_TICKET_KEY)).toBeNull();
    expect(hist.replaceState).toHaveBeenCalled();
  });

  it('leaves an enroll link fragment for the enroll capture', () => {
    const s = kv(); const hist = { replaceState: vi.fn() };
    const loc = { pathname: '/', search: '', hash: `#enroll=x&box=b&exp=1&login=${K}` };
    captureQrLogin(loc, hist, s);
    expect(hist.replaceState).not.toHaveBeenCalled();
    expect(readQrKey(s, QR_TICKET_KEY)).toBe(K);
    captureEnrollLink(loc, hist, s);
    expect(hist.replaceState).toHaveBeenCalled();
  });

  it('does nothing without QR params', () => {
    const hist = { replaceState: vi.fn() };
    captureQrLogin({ pathname: '/', search: '', hash: '#foo=1' }, hist, kv());
    expect(hist.replaceState).not.toHaveBeenCalled();
  });
});

describe('pollRequest', () => {
  const req = { id: K, secret: K, code: '1234', expiresAt: 0 };
  it('maps relay answers', async () => {
    const f = (status: number, body?: unknown) => (async () => new Response(body ? JSON.stringify(body) : null, { status })) as unknown as typeof fetch;
    expect(await pollRequest(req, f(410))).toEqual({ status: 'gone' });
    expect(await pollRequest(req, f(502))).toEqual({ status: 'error' });
    expect(await pollRequest(req, f(200, { status: 'pending' }))).toEqual({ status: 'pending' });
    expect(await pollRequest(req, f(200, { status: 'approved', tokenHash: 'h' }))).toEqual({ status: 'approved', tokenHash: 'h' });
  });
});

describe('describeUa', () => {
  it('names OS and browser', () => {
    expect(describeUa('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari');
    expect(describeUa('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Windows · Edge');
    expect(describeUa('')).toBe('aparelho desconhecido');
  });
});
