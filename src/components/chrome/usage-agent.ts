import type { PlanUsage, TeamBot } from '../../../shared/protocol';
import { usageRows, type UsageRow } from './usage-rows';
import { agentIdOf, billsClaudePlan } from '../../../shared/agents';
import { botDraftKey } from '../../../shared/team';

export type UsageAgent = 'claude' | 'grok';

interface UsageAgentCtx {
  activeId?: string;
  bots?: TeamBot[];
}

// In an agent's thread the bot's own model decides — the composer model there is
// whatever the last thread pinned, not who answers this thread.
export function effectiveModel(model: string | undefined, ctx: UsageAgentCtx = {}): string | undefined {
  if (ctx.activeId) {
    const bot = ctx.bots?.find((b) => (b.sessionId ?? botDraftKey(b.id)) === ctx.activeId);
    if (bot) return bot.model;
  }
  return model;
}

// Which account the header chip shows. Only Grok has its own meter; every other
// agent (and every Claude model) stays on the Claude plan.
export function usageAgentOf(model: string | undefined, ctx: UsageAgentCtx = {}): UsageAgent {
  const m = effectiveModel(model, ctx);
  return m && agentIdOf(m) === 'grok' ? 'grok' : 'claude';
}

// The composer lock is the Claude window. An ACP thread (Grok, and the Equipe
// bots pinned to it) keeps sending when that window is full.
export function claudeQuotaApplies(model: string | undefined, ctx: UsageAgentCtx = {}): boolean {
  return billsClaudePlan(effectiveModel(model, ctx));
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
