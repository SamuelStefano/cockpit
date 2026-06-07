import { describe, it, expect } from 'vitest';
import { supabaseStore } from './src/store';

function fakeFetch(routes: Record<string, { ok?: boolean; body?: unknown }>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const match = Object.keys(routes).find((k) => String(url).includes(k));
    const r = match ? routes[match] : { ok: true, body: [] };
    return { ok: r.ok ?? true, json: async () => r.body ?? [] } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const CFG = { url: 'https://proj.supabase.co', serviceKey: 'svc' };

describe('supabaseStore.agentById', () => {
  it('returns account + pubkey for an active agent', async () => {
    const { impl, calls } = fakeFetch({
      '/agent?id=eq.': { body: [{ account_id: 'acc-1', public_key: 'PUB' }] },
    });
    const store = supabaseStore({ ...CFG, fetchImpl: impl });
    expect(await store.agentById('ag-1')).toEqual({ accountId: 'acc-1', publicKey: 'PUB' });
    // scoped to non-revoked rows + sends the service key
    expect(calls[0].url).toContain('revoked_at=is.null');
    expect((calls[0].init?.headers as Record<string, string>).apikey).toBe('svc');
  });

  it('returns null when no active agent matches', async () => {
    const { impl } = fakeFetch({ '/agent': { body: [] } });
    const store = supabaseStore({ ...CFG, fetchImpl: impl });
    expect(await store.agentById('ghost')).toBeNull();
  });

  it('returns null on a non-ok response (fail-closed)', async () => {
    const { impl } = fakeFetch({ '/agent': { ok: false, body: [] } });
    const store = supabaseStore({ ...CFG, fetchImpl: impl });
    expect(await store.agentById('ag-1')).toBeNull();
  });

  it('url-encodes the agent id', async () => {
    const { impl, calls } = fakeFetch({ '/agent': { body: [] } });
    const store = supabaseStore({ ...CFG, fetchImpl: impl });
    await store.agentById('a/b c');
    expect(calls[0].url).toContain('id=eq.a%2Fb%20c');
  });
});

describe('supabaseStore.isAdmin', () => {
  it('is true only when the row says so', async () => {
    const t = supabaseStore({ ...CFG, fetchImpl: fakeFetch({ '/account': { body: [{ is_admin: true }] } }).impl });
    expect(await t.isAdmin('acc-1')).toBe(true);
    const fa = supabaseStore({ ...CFG, fetchImpl: fakeFetch({ '/account': { body: [{ is_admin: false }] } }).impl });
    expect(await fa.isAdmin('acc-1')).toBe(false);
    const none = supabaseStore({ ...CFG, fetchImpl: fakeFetch({ '/account': { body: [] } }).impl });
    expect(await none.isAdmin('acc-1')).toBe(false);
  });
});

describe('supabaseStore.markAgentSeen', () => {
  it('PATCHes last_seen and swallows errors', async () => {
    const { impl, calls } = fakeFetch({ '/agent': { body: [] } });
    const store = supabaseStore({ ...CFG, fetchImpl: impl });
    await store.markAgentSeen('ag-1');
    expect(calls[0].init?.method).toBe('PATCH');
    expect(String(calls[0].init?.body)).toContain('last_seen');
  });

  it('does not throw when fetch rejects', async () => {
    const impl = (async () => { throw new Error('network'); }) as unknown as typeof fetch;
    const store = supabaseStore({ ...CFG, fetchImpl: impl });
    await expect(store.markAgentSeen('ag-1')).resolves.toBeUndefined();
  });
});
