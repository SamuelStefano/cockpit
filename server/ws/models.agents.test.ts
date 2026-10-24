import { describe, it, expect, vi } from 'vitest';

vi.mock('../agents/store', () => ({ listAgentsSync: () => [{ id: 'grok', name: 'Grok', command: 'grok', args: [] }] }));

const { withAgents } = await import('./models');

describe('withAgents', () => {
  it('lists connected agents even before any Claude model is known', () => {
    expect(withAgents([])).toEqual([{ id: 'agent:grok', displayName: 'Grok · agente' }]);
  });
  it('appends agents after the Claude models', () => {
    expect(withAgents([{ id: 'claude-opus-5-5', displayName: 'Opus 5.5' }]).map((m) => m.id)).toEqual(['claude-opus-5-5', 'agent:grok']);
  });
});
