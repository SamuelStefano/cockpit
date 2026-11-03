import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Sign-in by QR, two directions, both in memory only (a relay restart just
// voids the pending QRs; nobody is locked out, they scan again).
//
// Ticket (signed-in device shows the QR): a one-time bearer bound to the
// account that minted it. The new device redeems it once for a Supabase
// magic-link token hash and becomes a session of that same account.
//
// Request (the login screen shows the QR): an unauthenticated device opens a
// request and keeps its secret; a signed-in device that scans the QR sees who
// asked (user agent) and approves or refuses. Only the holder of the secret can
// collect the approval, and only once.

export const QR_TICKET_TTL_MS = 10 * 60_000;
export const QR_REQUEST_TTL_MS = 3 * 60_000;
const MAX_ENTRIES = 2_000;
const UA_MAX = 160;

const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
export const isQrKey = (v: unknown): v is string => typeof v === 'string' && KEY_RE.test(v);

const newKey = () => randomBytes(32).toString('base64url');
const digest = (s: string) => createHash('sha256').update(s).digest();

interface Ticket { accountId: string; expiresAt: number }
interface Pending { secret: Buffer; ua: string; expiresAt: number; accountId?: string }

export type PollResult = { status: 'pending' } | { status: 'approved'; accountId: string } | { status: 'gone' };

export function cleanUa(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : '';
  return s.replace(/[^\x20-\x7e]/g, '').slice(0, UA_MAX);
}

export function createQrLogin(now: () => number = Date.now) {
  const tickets = new Map<string, Ticket>();
  const requests = new Map<string, Pending>();

  const sweep = () => {
    const t = now();
    for (const [k, v] of tickets) if (v.expiresAt <= t) tickets.delete(k);
    for (const [k, v] of requests) if (v.expiresAt <= t) requests.delete(k);
  };

  const liveRequest = (id: string): Pending | null => {
    const r = requests.get(id);
    if (!r) return null;
    if (r.expiresAt <= now()) { requests.delete(id); return null; }
    return r;
  };

  return {
    mintTicket(accountId: string): { ticket: string; expiresAt: number } | null {
      sweep();
      if (tickets.size >= MAX_ENTRIES) return null;
      const ticket = newKey();
      const expiresAt = now() + QR_TICKET_TTL_MS;
      tickets.set(ticket, { accountId, expiresAt });
      return { ticket, expiresAt };
    },

    // Single use: the ticket is gone whether or not the caller then succeeds.
    takeTicket(ticket: string): string | null {
      if (!isQrKey(ticket)) return null;
      const t = tickets.get(ticket);
      tickets.delete(ticket);
      if (!t || t.expiresAt <= now()) return null;
      return t.accountId;
    },

    openRequest(ua: unknown): { id: string; secret: string; expiresAt: number } | null {
      sweep();
      if (requests.size >= MAX_ENTRIES) return null;
      const id = newKey();
      const secret = newKey();
      const expiresAt = now() + QR_REQUEST_TTL_MS;
      requests.set(id, { secret: digest(secret), ua: cleanUa(ua), expiresAt });
      return { id, secret, expiresAt };
    },

    // What the approving device is shown. Already-answered requests are not.
    peekRequest(id: string): { ua: string; expiresAt: number } | null {
      if (!isQrKey(id)) return null;
      const r = liveRequest(id);
      if (!r || r.accountId) return null;
      return { ua: r.ua, expiresAt: r.expiresAt };
    },

    // First answer wins; a refusal deletes the request.
    answerRequest(id: string, accountId: string, approve: boolean): boolean {
      if (!isQrKey(id)) return false;
      const r = liveRequest(id);
      if (!r || r.accountId) return false;
      if (!approve) { requests.delete(id); return true; }
      r.accountId = accountId;
      return true;
    },

    // A wrong secret looks exactly like a missing request.
    poll(id: string, secret: string): PollResult {
      if (!isQrKey(id) || !isQrKey(secret)) return { status: 'gone' };
      const r = liveRequest(id);
      if (!r || !timingSafeEqual(r.secret, digest(secret))) return { status: 'gone' };
      if (!r.accountId) return { status: 'pending' };
      requests.delete(id);
      return { status: 'approved', accountId: r.accountId };
    },

    size: () => ({ tickets: tickets.size, requests: requests.size }),
  };
}

export type QrLogin = ReturnType<typeof createQrLogin>;
