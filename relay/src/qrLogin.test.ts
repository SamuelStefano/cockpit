import { describe, it, expect } from 'vitest';
import { createQrLogin, QR_REQUEST_TTL_MS, QR_TICKET_TTL_MS, cleanUa } from './qrLogin';

describe('createQrLogin', () => {
  it('expires tickets and requests', () => {
    let t = 1_000;
    const q = createQrLogin(() => t);
    const k = q.mintTicket('a')!;
    const r = q.openRequest('ua')!;
    t += Math.max(QR_TICKET_TTL_MS, QR_REQUEST_TTL_MS);
    expect(q.takeTicket(k.ticket)).toBeNull();
    expect(q.peekRequest(r.id)).toBeNull();
    expect(q.poll(r.id, r.secret)).toEqual({ status: 'gone' });
  });

  it('does not show or re-answer an approved request', () => {
    const q = createQrLogin();
    const r = q.openRequest('ua')!;
    expect(q.answerRequest(r.id, 'a', true)).toBe(true);
    expect(q.peekRequest(r.id)).toBeNull();
    expect(q.answerRequest(r.id, 'b', true)).toBe(false);
    expect(q.poll(r.id, r.secret)).toEqual({ status: 'approved', accountId: 'a' });
  });

  it('strips control and non-ASCII characters from the user agent', () => {
    expect(cleanUa('a\nbéc')).toBe('abc');
    expect(cleanUa(undefined)).toBe('');
    expect(cleanUa('x'.repeat(500))).toHaveLength(160);
  });
});
