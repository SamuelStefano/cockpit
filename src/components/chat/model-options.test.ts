import { describe, it, expect } from 'vitest';
import { FALLBACK_MODELS, catalogOptions, modelOptions, pickerGroups, splitAgentModels, withFamilies } from './model-options';

describe('model options', () => {
  it('offers Fable 5.1 when /v1/models has not loaded', () => {
    expect(modelOptions([], '').map((o) => o.id)).toContain('claude-fable-5-1');
  });

  it('adds Fable when the account list lacks it, without duplicating it when present', () => {
    const withoutFable = withFamilies([{ id: 'claude-opus-5', displayName: 'Opus 5' }]).map((o) => o.id);
    expect(withoutFable.filter((id) => id.includes('fable'))).toEqual(['claude-fable-5-1']);

    const withFable = withFamilies([{ id: 'claude-fable-5-1', displayName: 'Fable 5.1' }]).map((o) => o.id);
    expect(withFable.filter((id) => id.includes('fable'))).toEqual(['claude-fable-5-1']);
  });

  it('keeps the CLI aliases in the fallback', () => {
    expect(FALLBACK_MODELS.map((m) => m.id)).toEqual(expect.arrayContaining(['opus', 'sonnet', 'haiku']));
  });

  it('separates agent models and keeps a pinned agent visible when absent', () => {
    const opts = modelOptions([{ id: 'agent:grok', displayName: 'Grok · agente' }, { id: 'claude-opus-5', displayName: 'Opus 5' }], 'agent:grok');
    const split = splitAgentModels(opts);
    expect(split.agents.map((o) => o.id)).toEqual(['agent:grok']);
    expect(split.models.some((o) => o.id.startsWith('agent:'))).toBe(false);
    expect(splitAgentModels(modelOptions([], 'agent:gemini')).agents.map((o) => o.id)).toEqual(['agent:gemini']);
  });

  describe('pickerGroups', () => {
    const models = [
      { id: 'claude-opus-5', displayName: 'Opus 5' },
      { id: 'claude-haiku-4-5', displayName: 'Haiku 4.5' },
      { id: 'agent:grok', displayName: 'Grok · agente' },
    ];

    it('splits Anthropic from other agents and applies the hidden list', () => {
      const g = pickerGroups(models, 'claude-opus-5', [], ['family:haiku']);
      expect(g.anthropic.map((o) => o.id)).toEqual(['claude-opus-5', 'claude-fable-5-1', 'sonnet']);
      expect(g.others.map((o) => o.id)).toEqual(['agent:grok']);
      expect(g.allHidden).toBe(false);
    });

    it('leaves the other-agents group empty when every agent is hidden', () => {
      expect(pickerGroups(models, 'claude-opus-5', [], ['agent:grok']).others).toEqual([]);
    });

    it('keeps a hidden current model and dedupes custom ids', () => {
      const g = pickerGroups(models, 'agent:grok', ['claude-opus-5', 'claude-x-1'], ['agent:grok']);
      expect(g.others).toEqual([{ id: 'agent:grok', displayName: 'Grok · agente', hidden: true }]);
      expect(g.anthropic.filter((o) => o.id === 'claude-opus-5')).toHaveLength(1);
      expect(g.anthropic.map((o) => o.id)).toContain('claude-x-1');
    });
  });

  it('catalog lists hidden-or-not models once, custom ids included', () => {
    const ids = catalogOptions([{ id: 'claude-opus-5', displayName: 'Opus 5' }], ['claude-opus-5', 'claude-new-1']).map((o) => o.id);
    expect(ids).toEqual(['claude-opus-5', 'claude-fable-5-1', 'sonnet', 'haiku', 'claude-new-1']);
  });
});
