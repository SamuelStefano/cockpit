import type { Health } from './views.ts';

const TTL_MS = 30_000;

export function relayHealth(url: string, token: string | null, now: () => number, fetchImpl: typeof fetch = fetch): () => Promise<Health> {
  let cache: { at: number; h: Health } | null = null;
  return async () => {
    if (cache && now() - cache.at < TTL_MS) return cache.h;
    let h: Health;
    try {
      const res = await fetchImpl(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(3000) });
      const b = (await res.json()) as { ok?: boolean; uptimeSec?: number; agents?: number; browsers?: number };
      if (!res.ok || b.ok !== true) h = { ok: false, text: `relay HTTP ${res.status}` };
      else {
        const parts = [`relay ok`, `no ar há ${Math.floor((b.uptimeSec ?? 0) / 3600)} h`];
        if (typeof b.agents === 'number') parts.push(`${b.agents} box(es) online`);
        if (typeof b.browsers === 'number') parts.push(`${b.browsers} aba(s)`);
        h = { ok: true, text: parts.join(' · ') };
      }
    } catch {
      h = { ok: false, text: 'relay sem resposta' };
    }
    cache = { at: now(), h };
    return h;
  };
}
