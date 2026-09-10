import { describe, it, expect } from 'vitest';
import { FALLBACK_MODELS, modelOptions, withFamilies } from './model-options';

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
});
