import { describe, it, expect } from 'vitest';
import { kindLabel, whenShort } from './format';

describe('kindLabel', () => {
  it('mapeia os kinds', () => {
    expect(kindLabel('create')).toBe('registrou');
    expect(kindLabel('correct')).toBe('corrigiu');
    expect(kindLabel('note')).toBe('anotou');
    expect(kindLabel('delete')).toBe('excluiu');
  });
});

describe('whenShort', () => {
  it('shows only the time today and the date on other days', () => {
    const now = new Date(2026, 8, 24, 18, 0).getTime();
    expect(whenShort(new Date(2026, 8, 24, 9, 5).getTime(), now)).toBe('09:05');
    expect(whenShort(new Date(2026, 8, 20, 9, 5).getTime(), now)).toBe('20/09 09:05');
  });
});
