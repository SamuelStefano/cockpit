import { randomBytes, createHash } from 'node:crypto';
import type { RelayStore } from './index';

const PAIRING_TTL_MIN = 10;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

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
        `/agent?id=eq.${enc}&kind=eq.vps&revoked_at=is.null&select=account_id,public_key`,
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

    // Gera um código de pareamento (entropia no servidor), guarda só o HASH com TTL
    // curto, devolve o texto plano UMA vez (o browser mostra pro fellow).
    async createPairingCode(accountId, label = '') {
      const code = randomBytes(9).toString('base64url'); // ~12 chars
      const expires = new Date(Date.now() + PAIRING_TTL_MIN * 60_000).toISOString();
      const res = await f(`${base}/pairing_code`, {
        method: 'POST',
        headers: { ...headers, prefer: 'return=minimal' },
        body: JSON.stringify({ account_id: accountId, code_hash: sha256(code), label, expires_at: expires }),
      });
      if (!res.ok) throw new Error('createPairingCode failed');
      return code;
    },

    // Consome o código (single-use, atômico via UPDATE filtrado RETURNING). Devolve
    // o accountId dono se válido/não-usado/não-expirado; null caso contrário.
    async consumePairingCode(code) {
      const hash = encodeURIComponent(sha256(code));
      const nowIso = encodeURIComponent(new Date().toISOString());
      const res = await f(
        `${base}/pairing_code?code_hash=eq.${hash}&used_at=is.null&expires_at=gt.${nowIso}`,
        {
          method: 'PATCH',
          headers: { ...headers, prefer: 'return=representation' },
          body: JSON.stringify({ used_at: new Date().toISOString() }),
        },
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as { account_id: string }[];
      return Array.isArray(rows) && rows.length === 1 ? rows[0].account_id : null;
    },

    // Registra o agente pareado (pubkey nascida na VPS). Devolve o agentId gerado.
    async createAgent(accountId, publicKey, label = '') {
      const res = await f(`${base}/agent`, {
        method: 'POST',
        headers: { ...headers, prefer: 'return=representation' },
        body: JSON.stringify({ account_id: accountId, public_key: publicKey, kind: 'vps', label }),
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as { id: string }[];
      return Array.isArray(rows) && rows.length === 1 ? rows[0].id : null;
    },
  };
}
