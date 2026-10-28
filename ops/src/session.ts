import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = '__Host-ops_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const mac = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('base64url');

export function signSession(secret: string, userId: string, now: number): string {
  const body = `v1.${userId}.${now + SESSION_TTL_MS}`;
  return `${body}.${mac(secret, body)}`;
}

export function verifySession(secret: string, token: string | undefined, now: number): string | null {
  if (!token || token.length > 256) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const body = parts.slice(0, 3).join('.');
  const want = Buffer.from(mac(secret, body));
  const got = Buffer.from(parts[3]);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const exp = Number(parts[2]);
  if (!Number.isSafeInteger(exp) || exp <= now) return null;
  return parts[1];
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export function clearedCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}
