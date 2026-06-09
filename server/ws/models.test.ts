import { describe, it, expect } from 'vitest';
import { mapModels, limitModels } from './models';

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

  it('defaults to empty array for malformed bodies', () => {
    expect(mapModels({})).toEqual([]);
    expect(mapModels(null)).toEqual([]);
    expect(mapModels({ data: 'nope' })).toEqual([]);
  });

  it('keeps at most 2 newest Opus + latest Sonnet + latest Haiku (newest-first input)', () => {
    const ids = (m: { id: string }[]) => m.map((x) => x.id);
    const out = mapModels({
      data: [
        { id: 'claude-opus-4-8' },
        { id: 'claude-opus-4-7' },
        { id: 'claude-sonnet-4-6' },
        { id: 'claude-opus-4-6' },
        { id: 'claude-opus-4-5-20251101' },
        { id: 'claude-haiku-4-5-20251001' },
        { id: 'claude-sonnet-4-5-20250929' },
        { id: 'claude-opus-4-1-20250805' },
      ],
    });
    expect(ids(out)).toEqual([
      'claude-opus-4-8',
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ]);
  });

  it('drops models with no known family', () => {
    expect(limitModels([{ id: 'gpt-4o', displayName: 'gpt' }])).toEqual([]);
  });

  it('surfaces a brand-new claude family automatically (cap 2)', () => {
    const out = limitModels([
      { id: 'claude-fable-5-20260601', displayName: 'Fable 5' },
      { id: 'claude-fable-5-mini', displayName: 'Fable 5 mini' },
      { id: 'claude-fable-4', displayName: 'Fable 4' },
      { id: 'claude-opus-4-8', displayName: 'Opus 4.8' },
    ]).map((m) => m.id);
    expect(out).toEqual(['claude-fable-5-20260601', 'claude-fable-5-mini', 'claude-opus-4-8']);
  });
});
