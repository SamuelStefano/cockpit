import { describe, it, expect } from 'vitest';
import { mapModels } from './models';

describe('mapModels', () => {
  it('maps the live shape from /v1/models', () => {
    const m = mapModels({
      data: [
        { id: 'claude-opus-4-8', display_name: 'Claude Opus 4.8' },
        { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
      ],
    });
    expect(m).toEqual([
      { id: 'claude-opus-4-8', displayName: 'Claude Opus 4.8' },
      { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6' },
    ]);
  });

  it('falls back to id when display_name is missing', () => {
    expect(mapModels({ data: [{ id: 'claude-haiku-4-5' }] })).toEqual([
      { id: 'claude-haiku-4-5', displayName: 'claude-haiku-4-5' },
    ]);
  });

  it('drops entries without a string id', () => {
    expect(mapModels({ data: [{ display_name: 'x' }, { id: 42 }, { id: '' }] })).toEqual([]);
  });

  it('drops non-Claude ids (server --model validation would refuse them anyway)', () => {
    expect(mapModels({ data: [{ id: 'gpt-4o', display_name: 'gpt' }] })).toEqual([]);
  });

  it('defaults to empty array for malformed bodies', () => {
    expect(mapModels({})).toEqual([]);
    expect(mapModels(null)).toEqual([]);
    expect(mapModels({ data: 'nope' })).toEqual([]);
  });

  it('keeps the FULL Anthropic list in original order, new families included', () => {
    const data = [
      { id: 'claude-fable-5' },
      { id: 'claude-opus-4-8' },
      { id: 'claude-opus-4-7' },
      { id: 'claude-sonnet-4-6' },
      { id: 'claude-opus-4-6' },
      { id: 'claude-opus-4-5-20251101' },
      { id: 'claude-haiku-4-5-20251001' },
      { id: 'claude-sonnet-4-5-20250929' },
      { id: 'claude-opus-4-1-20250805' },
    ];
    expect(mapModels({ data }).map((m) => m.id)).toEqual(data.map((d) => d.id));
  });
});
