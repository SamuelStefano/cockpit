import { describe, it, expect } from 'vitest';
import { relTime, kindLabel } from './format';

describe('relTime', () => {
  const now = 1_000_000_000_000;
  it('sub-minuto = agora', () => expect(relTime(now - 10_000, now)).toBe('agora'));
  it('minutos', () => expect(relTime(now - 5 * 60_000, now)).toBe('há 5min'));
  it('horas', () => expect(relTime(now - 3 * 3_600_000, now)).toBe('há 3h'));
  it('dias', () => expect(relTime(now - 2 * 86_400_000, now)).toBe('há 2d'));
});

describe('kindLabel', () => {
  it('mapeia os kinds', () => {
    expect(kindLabel('create')).toBe('registrou');
    expect(kindLabel('correct')).toBe('corrigiu');
    expect(kindLabel('note')).toBe('anotou');
    expect(kindLabel('delete')).toBe('excluiu');
  });
});
