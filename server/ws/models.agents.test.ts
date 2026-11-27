import { describe, it, expect, vi } from 'vitest';

vi.mock('../agents/store', () => ({ listAgentsSync: () => [{ id: 'grok', name: 'Grok', command: 'grok', args: [] }] }));

const { withAgents } = await import('./models');
const { lastProbes } = await import('../agents/status');

describe('withAgents', () => {
  it('lists connected agents even before any Claude model is known', () => {
    expect(withAgents([])).toEqual([{ id: 'agent:grok', displayName: 'Grok · agente' }]);
  });
  it('appends agents after the Claude models', () => {
    expect(withAgents([{ id: 'claude-opus-5-5', displayName: 'Opus 5.5' }]).map((m) => m.id)).toEqual(['claude-opus-5-5', 'agent:grok']);
  });
  it('drops an agent whose last test says it cannot run, keeps it once ready', () => {
    lastProbes.set('grok', { status: 'needs-login', message: '', at: 1 });
    expect(withAgents([])).toEqual([]);
    lastProbes.set('grok', { status: 'ready', message: '', at: 2 });
    expect(withAgents([]).map((m) => m.id)).toEqual(['agent:grok']);
    lastProbes.clear();
  });
});
