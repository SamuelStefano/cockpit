import { describe, expect, it } from 'vitest';
import { AGENT_PRESETS, type AgentView } from '../../shared/agents';
import { activeStepFor, buildCards, customItems, splitArgs } from './agents-view';

const view = (over: Partial<AgentView>): AgentView => ({ id: 'grok', name: 'Grok', command: 'grok', args: [], status: 'ready', ...over });

describe('agents-view', () => {
  it('maps status to the highlighted step', () => {
    expect(activeStepFor('not-installed')).toBe(0);
    expect(activeStepFor('needs-login')).toBe(1);
    expect(activeStepFor('ready')).toBe(2);
    expect(activeStepFor('unknown')).toBe(2);
  });

  it('merges presets with connected items', () => {
    const cards = buildCards(AGENT_PRESETS, [view({ status: 'needs-login' })]);
    const grok = cards.find((c) => c.preset.id === 'grok')!;
    expect(grok.item).not.toBeNull();
    expect(grok.activeStep).toBe(1);
    const gemini = cards.find((c) => c.preset.id === 'gemini')!;
    expect(gemini.item).toBeNull();
    expect(gemini.status).toBe('unknown');
    expect(gemini.activeStep).toBe(0);
  });

  it('lists only non-preset items as custom', () => {
    const custom = view({ id: 'meu', name: 'Meu' });
    expect(customItems(AGENT_PRESETS, [view({}), custom])).toEqual([custom]);
  });

  it('splits args on whitespace', () => {
    expect(splitArgs('  acp  --x ')).toEqual(['acp', '--x']);
    expect(splitArgs('')).toEqual([]);
  });
});
