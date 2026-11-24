import { readOAuthToken } from '../oauth';

export interface ConnectorDef { type: 'claudeai-proxy'; url: string; id: string }

const ENDPOINT = 'https://api.anthropic.com/v1/mcp_servers?limit=1000';
const TIMEOUT_MS = 8_000;
const THROTTLE_MS = 5 * 60_000;

let cache: Record<string, ConnectorDef> = {};
let lastOkAt = 0;
let inflight: Promise<boolean> | null = null;

export function connectorDefs(list: unknown): Record<string, ConnectorDef> {
  const out: Record<string, ConnectorDef> = {};
  if (!Array.isArray(list)) return out;
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const { id, url, display_name } = e as Record<string, unknown>;
    if (typeof id !== 'string' || typeof url !== 'string' || typeof display_name !== 'string') continue;
    if (!id || !url || !display_name) continue;
    const base = `claude.ai ${display_name}`;
    let name = base;
    for (let n = 2; name in out; n++) name = `${base} (${n})`;
    out[name] = { type: 'claudeai-proxy', url, id };
  }
  return out;
}

function optedOut(): boolean {
  const v = process.env.ENABLE_CLAUDEAI_MCP_SERVERS?.trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'no' || v === 'off';
}

function sameNames(a: Record<string, ConnectorDef>, b: Record<string, ConnectorDef>): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => k in b);
}

async function doRefresh(fetchImpl: typeof fetch): Promise<boolean> {
  if (optedOut()) {
    const changed = Object.keys(cache).length > 0;
    cache = {};
    return changed;
  }
  const token = await readOAuthToken();
  if (!token) return false;
  try {
    const res = await fetchImpl(ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-servers-2025-12-04',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { data?: unknown };
    const next = connectorDefs(body?.data);
    const changed = !sameNames(cache, next);
    cache = next;
    lastOkAt = Date.now();
    return changed;
  } catch {
    return false;
  }
}

export function refreshClaudeAiConnectors(fetchImpl: typeof fetch = fetch, force = false): Promise<boolean> {
  if (inflight) return inflight;
  if (!force && Date.now() - lastOkAt < THROTTLE_MS) return Promise.resolve(false);
  inflight = doRefresh(fetchImpl).finally(() => { inflight = null; });
  return inflight;
}

export function claudeAiConnectorDefsSync(): Record<string, ConnectorDef> {
  return optedOut() ? {} : cache;
}

export function resetClaudeAiConnectorsForTest(): void {
  cache = {};
  lastOkAt = 0;
  inflight = null;
}
