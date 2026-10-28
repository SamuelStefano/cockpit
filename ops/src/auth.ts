import type { RateLimiter } from './rateLimit.ts';

export type LoginResult = { ok: true; userId: string } | { ok: false; reason: 'rate' | 'denied' | 'error' };

export interface LoginDeps {
  supabaseUrl: string;
  anonKey: string;
  adminIds: Set<string>;
  perIp: RateLimiter;
  global: RateLimiter;
  fetchImpl?: typeof fetch;
}

const TIMEOUT_MS = 10_000;

// Supabase checks the password; the allowlist decides who gets in. The Supabase
// session it hands back is only proof of the password, so it is revoked at once.
export async function login(deps: LoginDeps, ip: string, email: string, password: string): Promise<LoginResult> {
  if (!deps.perIp.hit(ip) || !deps.global.hit('*')) return { ok: false, reason: 'rate' };
  if (!email || !password || email.length > 320 || password.length > 1024) return { ok: false, reason: 'denied' };
  const f = deps.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f(`${deps.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: deps.anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'error' };
  }
  if (res.status >= 500) return { ok: false, reason: 'error' };
  if (!res.ok) return { ok: false, reason: 'denied' };
  const body = (await res.json().catch(() => null)) as { access_token?: string; user?: { id?: string } } | null;
  const userId = body?.user?.id?.toLowerCase();
  if (body?.access_token) {
    void f(`${deps.supabaseUrl}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: deps.anonKey, authorization: `Bearer ${body.access_token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => undefined);
  }
  if (!userId || !deps.adminIds.has(userId)) return { ok: false, reason: 'denied' };
  return { ok: true, userId };
}
