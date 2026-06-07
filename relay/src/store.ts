import type { RelayStore } from './index';

// Adapter Supabase do RelayStore (DR-023). Fala PostgREST com a service-role key
// (só no relay, NUNCA no bundle). Lê pubkey/conta do agente e is_admin; marca
// last_seen. fetch é injetável pra teste. Nada aqui spawna nem guarda chave privada.

export interface StoreConfig {
  url: string;            // https://<ref>.supabase.co
  serviceKey: string;     // SUPABASE_SERVICE_ROLE_KEY (server-only)
  fetchImpl?: typeof fetch;
}

export function supabaseStore(cfg: StoreConfig): RelayStore {
  const f = cfg.fetchImpl ?? fetch;
  const base = `${cfg.url.replace(/\/$/, '')}/rest/v1`;
  const headers = {
    apikey: cfg.serviceKey,
    authorization: `Bearer ${cfg.serviceKey}`,
    'content-type': 'application/json',
  };

  async function getOne<T>(path: string): Promise<T | null> {
    const res = await f(`${base}${path}`, { headers });
    if (!res.ok) return null;
    const rows = (await res.json()) as T[];
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  return {
    async agentById(agentId) {
      const enc = encodeURIComponent(agentId);
      const row = await getOne<{ account_id: string; public_key: string }>(
        `/agent?id=eq.${enc}&revoked_at=is.null&select=account_id,public_key`,
      );
      return row ? { accountId: row.account_id, publicKey: row.public_key } : null;
    },

    async isAdmin(accountId) {
      const enc = encodeURIComponent(accountId);
      const row = await getOne<{ is_admin: boolean }>(`/account?id=eq.${enc}&select=is_admin`);
      return row?.is_admin === true;
    },

    async markAgentSeen(agentId) {
      const enc = encodeURIComponent(agentId);
      // Best-effort: nunca derruba o fluxo de auth se o PATCH falhar.
      try {
        await f(`${base}/agent?id=eq.${enc}`, {
          method: 'PATCH',
          headers: { ...headers, prefer: 'return=minimal' },
          body: JSON.stringify({ last_seen: new Date().toISOString() }),
        });
      } catch { /* ignore */ }
    },
  };
}
