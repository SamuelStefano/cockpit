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

export interface AgentRow {
  id: string;
  account_id: string;
  kind: string;
  label: string;
  paired_at: string;
  last_seen: string | null;
  revoked_at: string | null;
}

export interface ReportFilter {
  accountIds?: string[];
  source?: string;
  kind?: string;
  boxIds?: string[];
  limit: number;
}

export interface OpsData {
  listReports(f: ReportFilter): Promise<DiagReport[]>;
  getReport(id: string): Promise<DiagReport | null>;
  reportsSince(cursorAt: string, limit: number): Promise<DiagReport[]>;
  listAgents(): Promise<AgentRow[]>;
  emails(): Promise<Map<string, string>>;
}

const TIMEOUT_MS = 10_000;
const EMAIL_TTL_MS = 5 * 60 * 1000;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const inList = (ids: string[]) => `in.(${ids.filter((x) => UUID.test(x)).join(',')})`;

// Service-role reads over PostgREST and the auth admin API. Server-only: the key
// never reaches a response.
export function createOpsData(cfg: { supabaseUrl: string; serviceKey: string; fetchImpl?: typeof fetch; now?: () => number }): OpsData {
  const f = cfg.fetchImpl ?? fetch;
  const now = cfg.now ?? Date.now;
  const headers = { apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}` };
  const get = async <T>(path: string): Promise<T> => {
    const res = await f(`${cfg.supabaseUrl}${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`GET ${path.split('?')[0]}: HTTP ${res.status}`);
    return (await res.json()) as T;
  };
  let emailCache: { at: number; map: Map<string, string> } | null = null;

  return {
    async listReports(fl) {
      const q = new URLSearchParams({ select: '*', order: 'created_at.desc', limit: String(Math.min(500, Math.max(1, fl.limit))) });
      if (fl.accountIds) q.set('account_id', inList(fl.accountIds));
      if (fl.boxIds) q.set('box_id', inList(fl.boxIds));
      if (fl.source) q.set('source', `eq.${fl.source}`);
      if (fl.kind) q.set('kind', `eq.${fl.kind}`);
      return get<DiagReport[]>(`/rest/v1/diag_reports?${q}`);
    },
    async getReport(id) {
      if (!UUID.test(id)) return null;
      const rows = await get<DiagReport[]>(`/rest/v1/diag_reports?select=*&id=eq.${id}`);
      return rows[0] ?? null;
    },
    async reportsSince(cursorAt, limit) {
      const q = new URLSearchParams({ select: '*', created_at: `gte.${cursorAt}`, order: 'created_at.asc,id.asc', limit: String(limit) });
      return get<DiagReport[]>(`/rest/v1/diag_reports?${q}`);
    },
    async listAgents() {
      return get<AgentRow[]>('/rest/v1/agent?select=id,account_id,kind,label,paired_at,last_seen,revoked_at&order=paired_at.desc&limit=1000');
    },
    async emails() {
      if (emailCache && now() - emailCache.at < EMAIL_TTL_MS) return emailCache.map;
      const map = new Map<string, string>();
      for (let page = 1; page <= 20; page++) {
        const body = await get<{ users?: { id: string; email?: string }[] }>(`/auth/v1/admin/users?page=${page}&per_page=500`);
        const users = body.users ?? [];
        for (const u of users) map.set(u.id, u.email ?? '');
        if (users.length < 500) break;
      }
      emailCache = { at: now(), map };
      return map;
    },
  };
}
