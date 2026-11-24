// Fetches the security-relevant state of one Supabase project via the Management API.
// All SQL is constant: nothing is ever interpolated into a query.

export interface SchemaRow { name: string; owner: string }
export interface TableRow { schema: string; name: string; kind: string; rls_enabled: boolean; rls_forced: boolean }
export interface GrantRow { schema: string; table: string; grantee: string; privilege: string }
export interface PolicyRow {
  schema: string; table: string; name: string; roles: string[]; cmd: string;
  permissive: string; qual: string | null; with_check: string | null;
}
export interface FunctionRow { schema: string; name: string; args: string; anon_exec: boolean; auth_exec: boolean }
export interface SchemaCreateRow { schema: string; grantee: string }
export interface EventTriggerRow { name: string; event: string; enabled: string; function: string }
export interface RoleRow { name: string; super: boolean; login: boolean; bypassrls: boolean; createrole: boolean }
export interface LintRow { name: string; level: string; key: string; detail: string }

export interface Snapshot {
  projectRef: string;
  projectName: string;
  takenAt: string;
  schemas: SchemaRow[];
  tables: TableRow[];
  grants: GrantRow[];
  policies: PolicyRow[];
  functions: FunctionRow[];
  schemaCreate: SchemaCreateRow[];
  eventTriggers: EventTriggerRow[];
  roles: RoleRow[];
  exposedSchemas: string[];
  lints: LintRow[];
}

export interface ProjectInfo { ref: string; name: string; status: string }

const API = 'https://api.supabase.com/v1';
const TIMEOUT_MS = 25_000;

const SYS_SCHEMAS =
  "'auth','storage','realtime','extensions','graphql','graphql_public','vault','pgsodium','pgsodium_masks','supabase_functions','supabase_migrations','net','cron','pgbouncer','_realtime','_analytics','tiger','topology'";
const NS_FILTER = `n.nspname !~ '^pg_' and n.nspname <> 'information_schema' and n.nspname not in (${SYS_SCHEMAS})`;

const KNOWN_ROLES =
  "'anon','authenticated','authenticator','service_role','supabase_admin','supabase_auth_admin','supabase_storage_admin','supabase_read_only_user','supabase_replication_admin','supabase_etl_admin','supabase_privileged_role','dashboard_user','postgres','pgbouncer','pgsodium_keyholder','pgsodium_keyiduser','pgsodium_keymaker'";

export const SNAPSHOT_SQL = `select json_build_object(
'schemas', (select coalesce(json_agg(json_build_object('name', n.nspname, 'owner', pg_get_userbyid(n.nspowner))), '[]'::json)
  from pg_namespace n where ${NS_FILTER}),
'tables', (select coalesce(json_agg(json_build_object('schema', n.nspname, 'name', c.relname, 'kind', c.relkind::text,
  'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity)), '[]'::json)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r','p','v','m') and ${NS_FILTER}),
'grants', (select coalesce(json_agg(json_build_object('schema', n.nspname, 'table', c.relname,
  'grantee', case when a.grantee = 0 then 'public' else pg_get_userbyid(a.grantee) end, 'privilege', a.privilege_type)), '[]'::json)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(c.relacl) a
  where c.relkind in ('r','p','v','m') and ${NS_FILTER}
  and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon','authenticated'))),
'policies', (select coalesce(json_agg(json_build_object('schema', p.schemaname, 'table', p.tablename, 'name', p.policyname,
  'roles', p.roles::text[], 'cmd', p.cmd, 'permissive', p.permissive, 'qual', p.qual, 'with_check', p.with_check)), '[]'::json)
  from pg_policies p
  where p.schemaname !~ '^pg_' and p.schemaname <> 'information_schema' and p.schemaname not in (${SYS_SCHEMAS})),
'functions', (select coalesce(json_agg(json_build_object('schema', n.nspname, 'name', f.proname,
  'args', pg_get_function_identity_arguments(f.oid),
  'anon_exec', has_function_privilege('anon', f.oid, 'EXECUTE'),
  'auth_exec', has_function_privilege('authenticated', f.oid, 'EXECUTE'))), '[]'::json)
  from pg_proc f join pg_namespace n on n.oid = f.pronamespace
  where f.prosecdef and ${NS_FILTER}),
'schemaCreate', (select coalesce(json_agg(json_build_object('schema', n.nspname,
  'grantee', case when a.grantee = 0 then 'public' else pg_get_userbyid(a.grantee) end)), '[]'::json)
  from pg_namespace n cross join lateral aclexplode(n.nspacl) a
  where ${NS_FILTER} and a.privilege_type = 'CREATE'
  and (a.grantee = 0 or pg_get_userbyid(a.grantee) in ('anon','authenticated'))),
'eventTriggers', (select coalesce(json_agg(json_build_object('name', e.evtname, 'event', e.evtevent,
  'enabled', e.evtenabled::text, 'function', pr.proname)), '[]'::json)
  from pg_event_trigger e join pg_proc pr on pr.oid = e.evtfoid),
'roles', (select coalesce(json_agg(json_build_object('name', r.rolname, 'super', r.rolsuper, 'login', r.rolcanlogin,
  'bypassrls', r.rolbypassrls, 'createrole', r.rolcreaterole)), '[]'::json)
  from pg_roles r where r.rolname !~ '^pg_' and r.rolname not in (${KNOWN_ROLES}))
) as snap`;

async function api(pat: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<Response> {
  return fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

const is2xx = (r: Response) => r.status >= 200 && r.status < 300;

async function apiJson(pat: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
  const res = await api(pat, method, path, body);
  if (!is2xx(res)) throw new Error(`${method} ${path.replace(/\/projects\/[^/]+/, '/projects/<ref>')} -> HTTP ${res.status}`);
  return res.json();
}

export async function listProjects(pat: string): Promise<ProjectInfo[]> {
  const data = await apiJson(pat, 'GET', '/projects');
  if (!Array.isArray(data)) throw new Error('unexpected projects payload');
  return data
    .map((p: Record<string, unknown>) => ({ ref: String(p.id ?? p.ref ?? ''), name: String(p.name ?? ''), status: String(p.status ?? '') }))
    .filter((p) => /^[a-z0-9]{10,40}$/.test(p.ref));
}

async function runQuery(pat: string, ref: string): Promise<unknown> {
  const body = { query: SNAPSHOT_SQL };
  let res = await api(pat, 'POST', `/projects/${ref}/database/query/read-only`, body);
  if (res.status === 404) res = await api(pat, 'POST', `/projects/${ref}/database/query`, body);
  if (!is2xx(res)) throw new Error(`database query -> HTTP ${res.status}`);
  return res.json();
}

function parseSnap(payload: unknown): Record<string, unknown> {
  const row = Array.isArray(payload) ? payload[0] : payload;
  let snap = (row as { snap?: unknown } | undefined)?.snap;
  if (typeof snap === 'string') snap = JSON.parse(snap);
  if (!snap || typeof snap !== 'object') throw new Error('unexpected query payload');
  return snap as Record<string, unknown>;
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export async function fetchSnapshot(pat: string, project: ProjectInfo): Promise<Snapshot> {
  const snap = parseSnap(await runQuery(pat, project.ref));

  const pg = (await apiJson(pat, 'GET', `/projects/${project.ref}/postgrest`)) as { db_schema?: string };
  const exposedSchemas = String(pg?.db_schema ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const adv = (await apiJson(pat, 'GET', `/projects/${project.ref}/advisors/security`)) as { lints?: unknown[] };
  const lints: LintRow[] = arr<Record<string, unknown>>(adv?.lints)
    .filter((l) => l.level === 'ERROR' || l.level === 'WARN')
    .map((l) => {
      const meta = (l.metadata ?? {}) as Record<string, unknown>;
      const name = String(l.name ?? '');
      const key = String(l.cache_key ?? `${name}:${meta.schema ?? ''}.${meta.name ?? ''}`);
      return { name, level: String(l.level), key, detail: String(l.detail ?? '') };
    });

  return {
    projectRef: project.ref,
    projectName: project.name,
    takenAt: new Date().toISOString(),
    schemas: arr(snap.schemas),
    tables: arr(snap.tables),
    grants: arr(snap.grants),
    policies: arr(snap.policies),
    functions: arr(snap.functions),
    schemaCreate: arr(snap.schemaCreate),
    eventTriggers: arr(snap.eventTriggers),
    roles: arr(snap.roles),
    exposedSchemas,
    lints,
  };
}
