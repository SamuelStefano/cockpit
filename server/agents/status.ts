import type { AgentStatus } from '../../shared/agents';

export interface RecordedProbe { status: AgentStatus; message: string; version?: string; at: number }

export const lastProbes = new Map<string, RecordedProbe>();

const UNAVAILABLE: ReadonlySet<AgentStatus> = new Set(['needs-login', 'not-installed', 'error']);

// An agent never tested ("unknown") stays listed: after a Deck restart every probe
// result is gone, and hiding them all would empty the picker until someone re-tests.
export function isAgentUnavailable(id: string): boolean {
  const r = lastProbes.get(id);
  return !!r && UNAVAILABLE.has(r.status);
}
