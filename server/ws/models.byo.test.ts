import { describe, it, expect, vi } from 'vitest';

const keys = vi.hoisted(() => ({ deepseek: 'sk-test-12345678' } as Record<string, string>));
vi.mock('../agents/store', () => ({ listAgentsSync: () => [] }));
vi.mock('../agents/byo-keys', () => ({ byoKeys: { get: (p: string) => keys[p] } }));

const { withAgents } = await import('./models');

describe('withAgents with provider keys', () => {
  it('lists only the models of providers that have a key', () => {
    const ids = withAgents([]).map((m) => m.id);
    expect(ids).toEqual(['agent:byo-deepseek-chat', 'agent:byo-deepseek-reasoner']);
  });
  it('labels each model with its provider and never exposes the key', () => {
    const list = withAgents([]);
    expect(list[0].displayName).toBe('DeepSeek Chat · DeepSeek');
    expect(JSON.stringify(list)).not.toContain('sk-test');
  });
});
