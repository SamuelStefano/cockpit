import { describe, it, expect } from 'vitest';
import { AGENT_ID_RE, agentModelId } from './agents';
import { BYO_KEY_RE, BYO_PROVIDERS, byoAgentId, byoModelOf } from './byo-providers';

describe('byo providers', () => {
  it('uses https base urls without trailing slash', () => {
    for (const p of BYO_PROVIDERS) expect(p.baseUrl).toMatch(/^https:\/\/[^/]+(\/[^/]+)*[^/]$/);
  });

  it('builds agent ids the agent registry accepts, all unique', () => {
    const ids = BYO_PROVIDERS.flatMap((p) => p.models.map((m) => byoAgentId(p.id, m.slug)));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(AGENT_ID_RE);
  });

  it('resolves a model id back to provider and model', () => {
    const r = byoModelOf(agentModelId('byo-deepseek-reasoner'));
    expect(r?.provider.id).toBe('deepseek');
    expect(r?.model.id).toBe('deepseek-reasoner');
    expect(byoModelOf('agent:grok')).toBeNull();
    expect(byoModelOf(undefined)).toBeNull();
  });

  it('rejects keys with whitespace or control characters', () => {
    expect(BYO_KEY_RE.test('sk-abcdefgh1234')).toBe(true);
    expect(BYO_KEY_RE.test('sk-abc defgh')).toBe(false);
    expect(BYO_KEY_RE.test('sk-abcdefgh\nX-Evil: 1')).toBe(false);
    expect(BYO_KEY_RE.test('short')).toBe(false);
  });
});
