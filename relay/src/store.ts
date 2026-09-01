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

// Sem timeout, um PostgREST que aceita a conexão e nunca responde pendura o socket
// que espera por ele (a aba no meio da auth, o agente no meio do handshake) até o
// TCP desistir — minutos, com o pré-auth ocupando slot o tempo todo.
const REQ_TIMEOUT_MS = 10_000;

export function supabaseStore(cfg: StoreConfig): RelayStore {
  const f = cfg.fetchImpl ?? fetch;
  const base = `${cfg.url.replace(/\/$/, '')}/rest/v1`;
  const headers = {
    apikey: cfg.serviceKey,
    authorization: `Bearer ${cfg.serviceKey}`,
    'content-type': 'application/json',
  };

  const req = (path: string, init: RequestInit = {}) =>
    f(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
    });

  async function getOne<T>(path: string): Promise<T | null> {
    const res = await req(path);
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

    async listAccounts() {
      const res = await req('/account?select=id,email,is_admin&order=created_at.asc');
      if (!res.ok) return [];
      const rows = (await res.json()) as { id: string; email: string; is_admin: boolean }[];
      return rows.map((r) => ({ id: r.id, email: r.email, isAdmin: r.is_admin === true }));
    },

    // Service-role escreve is_admin (a trigger guard_privileged_columns bloqueia
    // qualquer outro papel). O gate de QUEM pode chamar isto é no relay (root-only).
    async setAdmin(accountId, admin) {
      const enc = encodeURIComponent(accountId);
      const res = await req(`/account?id=eq.${enc}`, {
        method: 'PATCH',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify({ is_admin: admin }),
      });
      return res.ok;
    },

    async markAgentSeen(agentId) {
      const enc = encodeURIComponent(agentId);
      // Best-effort: nunca derruba o fluxo de auth se o PATCH falhar.
      try {
        await req(`/agent?id=eq.${enc}`, {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({ last_seen: new Date().toISOString() }),
        });
      } catch { /* ignore */ }
    },

    // Gera um código de pareamento (entropia no servidor), guarda só o HASH com TTL
    // curto, devolve o texto plano UMA vez (o browser mostra pro fellow).
    async createPairingCode(accountId, label = '') {
      const code = randomBytes(9).toString('base64url'); // ~12 chars
      const expires = new Date(Date.now() + PAIRING_TTL_MIN * 60_000).toISOString();
      const res = await req('/pairing_code', {
        method: 'POST',
        headers: { prefer: 'return=minimal' },
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
      const res = await req(
        `/pairing_code?code_hash=eq.${hash}&used_at=is.null&expires_at=gt.${nowIso}`,
        {
          method: 'PATCH',
          headers: { prefer: 'return=representation' },
          body: JSON.stringify({ used_at: new Date().toISOString() }),
        },
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as { account_id: string }[];
      return Array.isArray(rows) && rows.length === 1 ? rows[0].account_id : null;
    },

    // Registra o agente pareado (pubkey nascida na VPS). Devolve o agentId gerado.
    async createAgent(accountId, publicKey, label = '') {
      const res = await req('/agent', {
        method: 'POST',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({ account_id: accountId, public_key: publicKey, kind: 'vps', label }),
      });
      if (!res.ok) return null;
      const rows = (await res.json()) as { id: string }[];
      return Array.isArray(rows) && rows.length === 1 ? rows[0].id : null;
    },
  };
}
