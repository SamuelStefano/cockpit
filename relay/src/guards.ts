import type { IncomingMessage } from 'node:http';
import type { RawData } from 'ws';

// Pure helpers for the relay's edge hardening (origin, per-IP caps, subprotocol token).

export function parseCsvSet(csv: string | undefined, lower = false): Set<string> {
  return new Set(
    (csv ?? '').split(',').map((s) => (lower ? s.trim().toLowerCase() : s.trim())).filter(Boolean),
  );
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// The relay listens on loopback behind Caddy: XFF is trusted ONLY when the TCP peer is
// loopback, and only its LAST value (the one Caddy appended), never a client-sent one.
export function clientIp(req: Pick<IncomingMessage, 'socket' | 'headers'>): string {
  const peer = req.socket.remoteAddress ?? 'unknown';
  if (!LOOPBACK.has(peer)) return peer;
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff.join(',') : xff;
  const last = raw?.split(',').pop()?.trim();
  return last || peer;
}

// Empty allowlist = unrestricted (legacy). A request without Origin is not a browser.
export function originAllowed(allowed: ReadonlySet<string>, origin: string | undefined): boolean {
  if (allowed.size === 0 || origin === undefined) return true;
  return allowed.has(origin);
}

export const WS_SUBPROTOCOL = 'deck.v1';
const BEARER_PREFIX = 'bearer.';

// Browsers can't set headers on the WS handshake: the JWT rides as a subprotocol
// entry (`bearer.<JWT>`), which unlike `?token=` stays out of access logs.
export function tokenFromSubprotocol(header: string | string[] | undefined): string | null {
  const raw = Array.isArray(header) ? header.join(',') : header;
  for (const p of (raw ?? '').split(',')) {
    const t = p.trim();
    if (t.startsWith(BEARER_PREFIX) && t.length > BEARER_PREFIX.length) return t.slice(BEARER_PREFIX.length);
  }
  return null;
}

export function pickSubprotocol(protocols: Set<string>): string | false {
  return protocols.has(WS_SUBPROTOCOL) ? WS_SUBPROTOCOL : false;
}

export function rawLength(data: RawData): number {
  if (Array.isArray(data)) return data.reduce((n, b) => n + b.length, 0);
  return data instanceof ArrayBuffer ? data.byteLength : data.length;
}

// Counts concurrent holders per key; acquire returns a release fn or null at the cap.
export function makeLimiter(max: number) {
  const counts = new Map<string, number>();
  return (key: string): (() => void) | null => {
    const n = counts.get(key) ?? 0;
    if (n >= max) return null;
    counts.set(key, n + 1);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const c = (counts.get(key) ?? 1) - 1;
      if (c <= 0) counts.delete(key); else counts.set(key, c);
    };
  };
}
