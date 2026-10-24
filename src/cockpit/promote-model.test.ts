import { describe, expect, it } from 'vitest';
import { promoteModel } from './promote-model';

const list = [
  { id: 'agent:grok', displayName: 'Grok · agente' },
  { id: 'claude-opus-4-8', displayName: 'Opus 4.8' },
  { id: 'claude-sonnet-5', displayName: 'Sonnet 5' },
];

describe('promoteModel', () => {
  it('keeps a listed model', () => {
    expect(promoteModel(list, 'claude-opus-4-8')).toBe('claude-opus-4-8');
  });
  it('upgrades an alias to the concrete family version', () => {
    expect(promoteModel(list, 'opus')).toBe('claude-opus-4-8');
  });
  it('replaces a stale model with sonnet', () => {
    expect(promoteModel(list, 'claude-opus-4-7')).toBe('claude-sonnet-5');
  });
  it('never rewrites an agent pin, even when absent from the list', () => {
    expect(promoteModel(list.slice(1), 'agent:grok')).toBe('agent:grok');
    expect(promoteModel(list, 'agent:gone')).toBe('agent:gone');
  });
});
