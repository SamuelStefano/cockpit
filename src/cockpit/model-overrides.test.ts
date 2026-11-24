import { describe, it, expect } from 'vitest';
import { persistableModelOverrides } from './model-overrides';

describe('persistableModelOverrides', () => {
  const map = { a: 'opus', 'new-x': 'haiku', gone: 'sonnet' };

  it('never persists ephemeral new- keys', () => {
    expect(persistableModelOverrides(map, null)).toEqual({ a: 'opus', gone: 'sonnet' });
  });

  it('drops sessions that no longer exist once the list is known', () => {
    expect(persistableModelOverrides(map, new Set(['a']))).toEqual({ a: 'opus' });
  });
});
