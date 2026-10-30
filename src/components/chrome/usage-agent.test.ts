import { describe, it, expect } from 'vitest';
import type { PlanUsage, TeamBot } from '../../../shared/protocol';
import { claudeQuotaApplies, usageAgentOf, usageChip } from './usage-agent';

const u = (pct: number): PlanUsage => ({ fiveHour: pct, sevenDay: pct, resetsAt: null, sevenDayResetsAt: null, limits: [] });
const reading = (usage: PlanUsage | null) => ({ usage, blockedUntil: null, readAt: null, nextReadAt: null });

describe('usageAgentOf', () => {
  it('Grok only for agent:grok', () => {
    expect(usageAgentOf('agent:grok')).toBe('grok');
    expect(usageAgentOf('claude-opus-5-5')).toBe('claude');
    expect(usageAgentOf('agent:codex')).toBe('claude');
    expect(usageAgentOf(undefined)).toBe('claude');
  });

  it('in an agent thread, the bot decides', () => {
    const bots = [{ id: 'grk01', model: 'agent:grok', sessionId: 's-1' }, { id: 'cla01', model: 'claude-sonnet-5-5' }] as TeamBot[];
    expect(usageAgentOf('claude-opus-5-5', { activeId: 's-1', bots })).toBe('grok');
    expect(usageAgentOf('agent:grok', { activeId: 's-1', bots: [{ ...bots[0], model: 'claude-x' }] })).toBe('claude');
    expect(usageAgentOf('claude-opus-5-5', { activeId: 's-2', bots })).toBe('claude');
  });
});

describe('claudeQuotaApplies', () => {
  const bots = [{ id: 'grk01', model: 'agent:grok', sessionId: 's-1' }] as TeamBot[];

  it('trava o composer no Claude e solta no agente externo', () => {
    expect(claudeQuotaApplies('claude-opus-5-5')).toBe(true);
    expect(claudeQuotaApplies(undefined)).toBe(true);
    expect(claudeQuotaApplies('agent:grok')).toBe(false);
    expect(claudeQuotaApplies('agent:codex')).toBe(false);
  });

  it('na thread da Equipe vale o modelo do bot, não o seletor', () => {
    expect(claudeQuotaApplies('claude-opus-5-5', { activeId: 's-1', bots })).toBe(false);
    const claudeBot = [{ id: 'c1', model: 'claude-sonnet-5', sessionId: 's-2' }] as TeamBot[];
    expect(claudeQuotaApplies('agent:grok', { activeId: 's-2', bots: claudeBot })).toBe(true);
  });
});

describe('usageChip', () => {
  it('Grok in the chip, Claude listed below, no Claude quota gate', () => {
    const c = usageChip('grok', reading(u(10)), reading(u(70)));
    expect(c.agent).toBe('grok');
    expect(c.usage?.fiveHour).toBe(70);
    expect(c.gate).toBe(false);
    expect(c.secondary?.title).toBe('Claude');
  });

  it('Claude in the chip; Grok below only when it has a number', () => {
    expect(usageChip('claude', reading(u(10)), reading(null)).secondary).toBeUndefined();
    const c = usageChip('claude', reading(u(10)), reading(u(30)));
    expect(c.usage?.fiveHour).toBe(10);
    expect(c.gate).toBe(true);
    expect(c.secondary?.title).toBe('Grok');
  });

  it('Grok without any state falls back to Claude instead of crashing', () => {
    expect(usageChip('grok', reading(u(10)), undefined).agent).toBe('claude');
  });
});
