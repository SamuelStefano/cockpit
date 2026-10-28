import { existsSync } from 'node:fs';
import { hostname, homedir } from 'node:os';
import { join } from 'node:path';
import type { Connection, ConnectionState } from '../shared/connections';
import type { AgentStatus, AgentView } from '../shared/agents';
import { agentIdOf } from '../shared/agents';
import type { DflMcpStatus, DflMcpsState } from '../shared/dfl-mcps';
import type { TeamBot } from '../shared/protocol';
import type { BoxInfo } from '../shared/boxes';
import { sanitizeBoxLabel } from '../shared/boxes';
import { dflMcpsState } from './dfl-mcps';
import { agentViews } from './agents/probe';
import { getTeam } from './team';
import { listDevices, type Device } from './e2e/devices';
import { authHold } from './ws/auth-health';

const DETAIL_MAX = 160;
const CLAUDE_CREDENTIALS = () => join(homedir(), '.claude', '.credentials.json');

const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(?:sk|pk|rk|xox[abprs]|gh[pousr]|glpat|AKIA|AIza)[-_A-Za-z0-9]{8,}/g,
  /\bBearer\s+\S+/gi,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]*)?/g,
  /\b[A-Fa-f0-9]{32,}\b/g,
  /\b[A-Za-z0-9+/_-]{40,}={0,2}/g,
  /([?&](?:token|key|secret|password|code|access_token|api_key)=)[^&\s]+/gi,
];

export function safeDetail(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  let s = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const re of SECRET_PATTERNS) s = s.replace(re, (m, p1) => (typeof p1 === 'string' ? `${p1}[removido]` : '[removido]'));
  if (!s) return undefined;
  return s.length > DETAIL_MAX ? `${s.slice(0, DETAIL_MAX - 1)}…` : s;
}

const AGENT_STATE: Record<AgentStatus, ConnectionState> = {
  ready: 'connected',
  'needs-login': 'expired',
  error: 'error',
  'not-installed': 'off',
  unknown: 'off',
};

const MCP_STATE: Record<DflMcpStatus, ConnectionState> = {
  connected: 'connected',
  'needs-auth': 'expired',
  failed: 'error',
  missing: 'off',
};

export function botsUsingAgent(bots: readonly TeamBot[], agentId: string): string[] {
  return bots.filter((b) => b.model && agentIdOf(b.model) === agentId).map((b) => b.id);
}

export function claudeProvider(bots: readonly TeamBot[], present: boolean, held: boolean): Connection {
  const state: ConnectionState = !present ? 'off' : held ? 'expired' : 'connected';
  const detail = !present ? 'nenhum login do Claude Code nesta máquina' : held ? 'o login expirou e não renovou sozinho' : undefined;
  const usedBy = bots.filter((b) => !b.model || agentIdOf(b.model) === null).map((b) => b.id);
  return { id: 'provider:claude', kind: 'provider', label: 'Claude', state, ...(detail ? { detail } : {}), usedBy };
}

export function agentConnection(a: AgentView, bots: readonly TeamBot[]): Connection {
  const detail = a.status === 'unknown' ? 'ainda não testado' : safeDetail(a.detail);
  return {
    id: `provider:${a.id}`, kind: 'provider', label: a.name, state: AGENT_STATE[a.status],
    ...(detail ? { detail } : {}), usedBy: botsUsingAgent(bots, a.id),
  };
}

export function mcpConnections(state: DflMcpsState): Connection[] {
  const detail = safeDetail(state.error);
  // A host the user never added is a catalog entry, not a connection: it lives in
  // "Gerenciar ferramentas" and would otherwise show as an unremovable row.
  return state.hosts.filter((h) => h.status !== 'missing').map((h) => {
    const d = state.error ? detail : safeDetail(h.detail);
    return { id: `tool:${h.host}`, kind: 'tool' as const, label: h.name, state: MCP_STATE[h.status], ...(d ? { detail: d } : {}) };
  });
}

export function machineConnections(self: { label: string; now: number }, boxes: readonly BoxInfo[] = []): Connection[] {
  const out: Connection[] = [{ id: 'machine:self', kind: 'machine', label: sanitizeBoxLabel(self.label) || 'Esta máquina', state: 'connected', detail: 'esta máquina', lastUsed: self.now }];
  for (const b of boxes) {
    const seen = b.lastSeen ? Date.parse(b.lastSeen) : NaN;
    out.push({
      id: `machine:${b.id}`, kind: 'machine', label: sanitizeBoxLabel(b.label) || 'Máquina',
      state: b.online ? 'connected' : 'off', ...(Number.isFinite(seen) ? { lastUsed: seen } : {}),
    });
  }
  return out;
}

export function deviceConnections(devices: readonly Device[]): Connection[] {
  return devices.map((d) => {
    const seen = Date.parse(d.lastSeen ?? '');
    return {
      id: `device:${d.pub.slice(0, 8)}`, kind: 'device' as const, label: sanitizeBoxLabel(d.label) || 'Aparelho',
      state: 'connected' as const, ...(Number.isFinite(seen) ? { lastUsed: seen } : {}),
    };
  });
}

export interface ConnectionsDeps {
  mcps?: () => Promise<DflMcpsState>;
  agents?: () => AgentView[];
  team?: () => Promise<TeamBot[]>;
  devices?: () => Device[];
  boxes?: () => readonly BoxInfo[];
  claudePresent?: () => boolean;
  claudeHeld?: () => boolean;
  hostLabel?: () => string;
  now?: () => number;
}

async function settle<T>(p: () => Promise<T> | T, fallback: T): Promise<T> {
  try { return await p(); } catch { return fallback; }
}

export async function listConnections(deps: ConnectionsDeps = {}): Promise<Connection[]> {
  const bots = await settle(deps.team ?? getTeam, [] as TeamBot[]);
  const mcps = await settle(deps.mcps ?? dflMcpsState, { hosts: [], source: 'fallback' } as DflMcpsState);
  const agents = await settle(deps.agents ?? agentViews, [] as AgentView[]);
  const devices = await settle(deps.devices ?? listDevices, [] as Device[]);
  const boxes = await settle(deps.boxes ?? (() => []), [] as readonly BoxInfo[]);
  const present = (deps.claudePresent ?? (() => existsSync(CLAUDE_CREDENTIALS())))();
  const held = (deps.claudeHeld ?? authHold)();
  return [
    claudeProvider(bots, present, held),
    ...agents.map((a) => agentConnection(a, bots)),
    ...mcpConnections(mcps),
    ...machineConnections({ label: (deps.hostLabel ?? hostname)(), now: (deps.now ?? Date.now)() }, boxes),
    ...deviceConnections(devices),
  ];
}
