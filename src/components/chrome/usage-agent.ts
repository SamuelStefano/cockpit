import type { PlanUsage, TeamBot } from '../../../shared/protocol';
import { usageRows, type UsageRow } from './usage-rows';
import { agentIdOf } from '../../../shared/agents';
import { botDraftKey } from '../../../shared/team';

export type UsageAgent = 'claude' | 'grok';

interface UsageAgentCtx {
  route?: string;
  activeId?: string;
  bots?: TeamBot[];
}

// Which account the header chip shows: the one the agent on screen spends. In
// the Equipe the bot's own model decides — the composer model there is whatever
// the last thread pinned, not who answers this thread. Only Grok has its own
// meter; every other agent (and every Claude model) stays on the Claude plan.
export function usageAgentOf(model: string | undefined, ctx: UsageAgentCtx = {}): UsageAgent {
  let m = model;
  if (ctx.route === '/equipe' && ctx.activeId) {
    const bot = ctx.bots?.find((b) => (b.sessionId ?? botDraftKey(b.id)) === ctx.activeId);
    if (bot) m = bot.model;
  }
  return m && agentIdOf(m) === 'grok' ? 'grok' : 'claude';
}

export interface UsageReading {
  usage: PlanUsage | null;
  blockedUntil: number | null;
  readAt: number | null;
  nextReadAt: number | null;
}

export interface UsageChip extends UsageReading {
  agent: UsageAgent;
  // The other account, listed under the main rows when it has a number.
  secondary?: { title: string; rows: UsageRow[] };
  // The quota gate (warn/paused) is the Claude plan's: on Grok it would lie.
  gate: boolean;
}

export function usageChip(agent: UsageAgent, claude: UsageReading, grok: UsageReading | undefined): UsageChip {
  const main = agent === 'grok' && grok ? grok : claude;
  const other = agent === 'grok' ? claude : grok;
  const rows = other ? usageRows(other.usage) : [];
  return {
    ...main,
    agent: agent === 'grok' && grok ? 'grok' : 'claude',
    secondary: rows.length ? { title: agent === 'grok' ? 'Claude' : 'Grok', rows } : undefined,
    gate: !(agent === 'grok' && grok),
  };
}
