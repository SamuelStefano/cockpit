import { randomBytes, createHash } from 'node:crypto';
import type { DiagReportRow, RelayStore } from './index';

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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHARE_PURGE_PAGE = 100;
const SHARE_PURGE_ROUNDS = 50;

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
      // A failed read must not look like "unknown agent": the agent backs off for
      // minutes on that answer, so a PostgREST blip would park every box. Throwing
      // closes 4500 and the agent retries on its normal backoff.
      const res = await req(`/agent?id=eq.${enc}&kind=eq.vps&revoked_at=is.null&select=account_id,public_key,paired_at`);
      if (!res.ok) throw new Error(`agentById failed: ${res.status}`);
      const rows = (await res.json()) as { account_id: string; public_key: string; paired_at?: string }[];
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      return row ? { accountId: row.account_id, publicKey: row.public_key, pairedAt: row.paired_at } : null;
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

    async listBoxes(accountId) {
      const enc = encodeURIComponent(accountId);
      const res = await req(`/agent?account_id=eq.${enc}&kind=eq.vps&revoked_at=is.null&select=id,label,last_seen&order=paired_at.asc`);
      if (!res.ok) throw new Error('listBoxes failed');
      const rows = (await res.json()) as { id: string; label: string | null; last_seen: string | null }[];
      return rows.map((r) => ({ id: r.id, label: r.label ?? '', lastSeen: r.last_seen }));
    },

    // Both writes filter by the JWT's account too: a box id of another account
    // matches no row. The body carries only the one column each action owns.
    async renameBox(accountId, agentId, label) {
      const res = await req(`/agent?id=eq.${encodeURIComponent(agentId)}&account_id=eq.${encodeURIComponent(accountId)}&kind=eq.vps&revoked_at=is.null`, {
        method: 'PATCH',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) return false;
      const rows = (await res.json()) as unknown[];
      return Array.isArray(rows) && rows.length === 1;
    },

    async revokeBox(accountId, agentId) {
      const res = await req(`/agent?id=eq.${encodeURIComponent(agentId)}&account_id=eq.${encodeURIComponent(accountId)}&kind=eq.vps&revoked_at=is.null`, {
        method: 'PATCH',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      });
      if (!res.ok) return false;
      const rows = (await res.json()) as unknown[];
      return Array.isArray(rows) && rows.length === 1;
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
      return { code, expiresAt: expires };
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

    // Account deletion (store review 5.1.1(v)). Share snapshots first: they live in
    // a public bucket and no FK ties them to the user, so they must go while the id
    // is still ours to name. Then the auth user; account/agent/pairing rows cascade
    // from it (migration 0001). A user already gone (404) counts as done, so a retry
    // after a lost response succeeds. Any other failure throws: nothing is half-deleted
    // silently and the caller can retry.
    // QR sign-in: a magic-link token hash for this exact user, never emailed.
    // The address is read from the user row (not the caller's JWT) and the link
    // must come back for the same id, or nothing is handed out.
    async mintLoginToken(accountId) {
      if (!UUID.test(accountId)) throw new Error('mintLoginToken: bad id');
      const root = cfg.url.replace(/\/$/, '');
      const authz = { apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}`, 'content-type': 'application/json' };
      const u = await f(`${root}/auth/v1/admin/users/${accountId}`, { headers: authz, signal: AbortSignal.timeout(REQ_TIMEOUT_MS) });
      if (!u.ok) throw new Error(`user read failed: ${u.status}`);
      const user = (await u.json()) as { id?: string; email?: string; banned_until?: string | null };
      if (user.id !== accountId || !user.email) throw new Error('user mismatch');
      if (user.banned_until && Date.parse(user.banned_until) > Date.now()) throw new Error('user banned');
      const g = await f(`${root}/auth/v1/admin/generate_link`, {
        method: 'POST', headers: authz, signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
        body: JSON.stringify({ type: 'magiclink', email: user.email }),
      });
      if (!g.ok) throw new Error(`generate_link failed: ${g.status}`);
      const j = (await g.json()) as { id?: string; hashed_token?: string; user?: { id?: string }; properties?: { hashed_token?: string } };
      const hash = j.properties?.hashed_token ?? j.hashed_token;
      if ((j.user?.id ?? j.id) !== accountId || typeof hash !== 'string' || !hash) throw new Error('generate_link mismatch');
      return hash;
    },

    async deleteAccount(accountId) {
      if (!UUID.test(accountId)) throw new Error('deleteAccount: bad id');
      const root = cfg.url.replace(/\/$/, '');
      const authz = { apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}`, 'content-type': 'application/json' };
      for (let round = 0; round < SHARE_PURGE_ROUNDS; round++) {
        const list = await f(`${root}/storage/v1/object/list/shares`, {
          method: 'POST', headers: authz, signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
          body: JSON.stringify({ prefix: `${accountId}/`, limit: SHARE_PURGE_PAGE, offset: 0 }),
        });
        if (!list.ok) throw new Error(`share list failed: ${list.status}`);
        const items = (await list.json()) as { name?: string; id?: string | null }[];
        const names = (Array.isArray(items) ? items : []).filter((o) => o.id && typeof o.name === 'string' && o.name).map((o) => `${accountId}/${o.name}`);
        if (names.length === 0) break;
        const del = await f(`${root}/storage/v1/object/shares`, {
          method: 'DELETE', headers: authz, signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
          body: JSON.stringify({ prefixes: names }),
        });
        if (!del.ok) throw new Error(`share delete failed: ${del.status}`);
        if (names.length < SHARE_PURGE_PAGE) break;
      }
      const res = await f(`${root}/auth/v1/admin/users/${accountId}`, {
        method: 'DELETE', headers: authz, signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      });
      if (res.status === 404) return true;
      if (!res.ok) throw new Error(`auth delete failed: ${res.status}`);
      return true;
    },

    async insertDiagReport(row: DiagReportRow) {
      const res = await req('/diag_reports', {
        method: 'POST',
        headers: { prefer: 'return=minimal' },
        body: JSON.stringify(row),
      });
      return res.ok;
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

export interface DiagReport {
  id: string;
  created_at: string;
  account_id: string;
  source: string;
  kind: string;
  box_id: string | null;
  app_version: string | null;
  user_agent: string | null;
  payload: unknown;
}

// Operator read path (relay/scripts/diag-reports.ts): service role, newest first.
export async function listDiagReports(cfg: StoreConfig, opts: { limit: number; accountId?: string }): Promise<DiagReport[]> {
  const f = cfg.fetchImpl ?? fetch;
  const limit = Math.max(1, Math.min(500, Math.floor(opts.limit)));
  const filter = opts.accountId ? `&account_id=eq.${encodeURIComponent(opts.accountId)}` : '';
  const res = await f(`${cfg.url.replace(/\/$/, '')}/rest/v1/diag_reports?select=*&order=created_at.desc&limit=${limit}${filter}`, {
    headers: { apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}` },
    signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`diag_reports: HTTP ${res.status}`);
  return (await res.json()) as DiagReport[];
}
