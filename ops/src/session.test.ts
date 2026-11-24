import { describe, expect, it } from 'vitest';
import { readCookie, SESSION_TTL_MS, sessionCookie, signSession, verifySession } from './session.ts';

const SECRET = 'x'.repeat(40);
const USER = '11111111-2222-3333-4444-555555555555';

describe('session', () => {
  it('round-trips the user id', () => {
    expect(verifySession(SECRET, signSession(SECRET, USER, 1000), 2000)).toBe(USER);
  });

  it('expires after 8 hours', () => {
    const t = signSession(SECRET, USER, 0);
    expect(verifySession(SECRET, t, SESSION_TTL_MS - 1)).toBe(USER);
    expect(verifySession(SECRET, t, SESSION_TTL_MS)).toBeNull();
  });

  it('rejects tampering and a foreign secret', () => {
    const t = signSession(SECRET, USER, 0);
    const [v, , exp, mac] = t.split('.');
    expect(verifySession(SECRET, [v, '99999999-2222-3333-4444-555555555555', exp, mac].join('.'), 1)).toBeNull();
    expect(verifySession(SECRET, [v, USER, String(Number(exp) * 10), mac].join('.'), 1)).toBeNull();
    expect(verifySession(SECRET, `${t.slice(0, -1)}${t.endsWith('A') ? 'B' : 'A'}`, 1)).toBeNull();
    expect(verifySession('y'.repeat(40), t, 1)).toBeNull();
    expect(verifySession(SECRET, 'garbage', 1)).toBeNull();
    expect(verifySession(SECRET, undefined, 1)).toBeNull();
  });

  it('sets a hardened cookie and reads it back', () => {
    const c = sessionCookie('abc');
    expect(c).toMatch(/^__Host-ops_session=abc;/);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) expect(c).toContain(flag);
    expect(readCookie('a=1; __Host-ops_session=tok.en; b=2', '__Host-ops_session')).toBe('tok.en');
  });
});
