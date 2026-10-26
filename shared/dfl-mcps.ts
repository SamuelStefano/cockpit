// DFL MCP hosts: manifest parsing, `claude mcp list` parsing and the argv for
// `claude mcp add`. Pure, no node:* import: the server and the UI share it.

export const DFL_MANIFEST_URL = 'https://mcp.devfellowship.com/tools-manifest.json';

export type DflMcpStatus = 'connected' | 'needs-auth' | 'failed' | 'missing';

export interface DflMcpEndpoint {
  host: string;
  endpoint: string;
}

export interface DflMcpHostState extends DflMcpEndpoint {
  // The name the server is configured under (it may not be `dfl-<host>`), or the
  // name `add` will use when missing.
  name: string;
  status: DflMcpStatus;
  detail?: string;
}

export interface DflMcpsState {
  hosts: DflMcpHostState[];
  source: 'manifest' | 'fallback';
  // Set when `claude mcp list` could not run: statuses are then unknown.
  error?: string;
  // Result of the last add, shown as a toast.
  op?: { ok: boolean; message: string };
}

// A host is one DNS label. Anything else (spaces, flags, shell metacharacters,
// a leading dash that `claude` would read as an option) is rejected.
const HOST_RE = /^[a-z][a-z0-9]{0,31}(?:-[a-z0-9]{1,31}){0,3}$/;
const ENDPOINT_RE = /^https:\/\/([a-z0-9-]+)\.mcp\.devfellowship\.com\/mcp$/;

export function validHost(host: unknown): host is string {
  return typeof host === 'string' && HOST_RE.test(host);
}

export function mcpName(host: string): string {
  return `dfl-${host}`;
}

// Used when the manifest cannot be fetched. Kept small on purpose: the manifest
// is the source of truth and the Deck refreshes from it whenever it answers.
export const FALLBACK_HOSTS: readonly DflMcpEndpoint[] = [
  'campaigns', 'learn', 'ops', 'payments', 'plans', 'proposals', 'skills', 'studio', 'work',
].map((host) => ({ host, endpoint: `https://${host}.mcp.devfellowship.com/mcp` }));

// Only `published: true` hosts whose endpoint is exactly https://<host>.mcp.devfellowship.com/mcp
// survive: the docs site (mcp.devfellowship.com) is not an MCP endpoint, and a
// tampered manifest must not make the Deck register an arbitrary URL.
export function parseManifest(raw: unknown): DflMcpEndpoint[] | null {
  const hosts = (raw as { hosts?: unknown } | null)?.hosts;
  if (!Array.isArray(hosts)) return null;
  const out: DflMcpEndpoint[] = [];
  const seen = new Set<string>();
  for (const h of hosts) {
    const e = h as { host?: unknown; endpoint?: unknown; published?: unknown };
    if (e?.published !== true || !validHost(e.host) || typeof e.endpoint !== 'string') continue;
    const m = ENDPOINT_RE.exec(e.endpoint);
    if (!m || m[1] !== e.host || seen.has(e.host)) continue;
    seen.add(e.host);
    out.push({ host: e.host, endpoint: e.endpoint });
  }
  return out.length ? out : null;
}

export interface ListedMcp {
  name: string;
  target: string;
  status: Exclude<DflMcpStatus, 'missing'>;
  detail?: string;
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;
const LINE_RE = /^(.+?): (.+?) - (✔|!|✘|⚠)\s*(.*)$/;

// Lines look like `name: https://host/mcp (HTTP) - ✔ Connected`. The name may
// itself contain ": " ("claude.ai Claude Docs"), hence the lazy first group.
export function parseMcpList(output: string): ListedMcp[] {
  const out: ListedMcp[] = [];
  for (const line of output.replace(ANSI_RE, '').split(/\r?\n/)) {
    const m = LINE_RE.exec(line.trim());
    if (!m) continue;
    const [, name, rawTarget, mark, text] = m;
    const target = rawTarget.replace(/\s+\((?:HTTP|SSE|stdio)\)$/i, '');
    const status = mark === '✔' ? 'connected' : /auth/i.test(text) ? 'needs-auth' : 'failed';
    out.push({ name, target, status, detail: status === 'connected' ? undefined : text || undefined });
  }
  return out;
}

const sameUrl = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');

export function mergeStates(endpoints: readonly DflMcpEndpoint[], listed: readonly ListedMcp[]): DflMcpHostState[] {
  return endpoints.map((e) => {
    const hit = listed.find((l) => sameUrl(l.target, e.endpoint)) ?? listed.find((l) => l.name === mcpName(e.host));
    if (!hit) return { ...e, name: mcpName(e.host), status: 'missing' as const };
    return { ...e, name: hit.name, status: hit.status, detail: hit.detail };
  });
}

// argv for execFile('claude', argv): never a shell string.
export function addArgv(e: DflMcpEndpoint): string[] {
  return ['mcp', 'add', '--transport', 'http', '--scope', 'user', mcpName(e.host), e.endpoint];
}

// What the "Entrar" button types into the terminal. `name` comes from the server
// state, but is re-checked: it ends up on a shell line.
export function loginCommand(name: string): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(name) ? `claude mcp login ${name}` : null;
}
