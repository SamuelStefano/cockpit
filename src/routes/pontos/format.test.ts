import { describe, it, expect } from 'vitest';
import { kindLabel } from './format';

describe('kindLabel', () => {
  it('mapeia os kinds', () => {
    expect(kindLabel('create')).toBe('registrou');
    expect(kindLabel('correct')).toBe('corrigiu');
    expect(kindLabel('note')).toBe('anotou');
    expect(kindLabel('delete')).toBe('excluiu');
  });
});
