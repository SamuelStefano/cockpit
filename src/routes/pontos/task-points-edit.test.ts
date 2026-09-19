import { describe, it, expect } from 'vitest';
import { taskPointsEdit } from './task-points-edit';

describe('taskPointsEdit', () => {
  it('task fracionada abre sem alteração pendente', () => {
    const e = taskPointsEdit('2.5', 2.5);
    expect(e.changed).toBe(false);
    expect(e.next).toBe(2);
    expect(e.willTruncate).toBe(true);
  });

  it('aceita vírgula e detecta a mudança de verdade', () => {
    expect(taskPointsEdit('3,0', 2).changed).toBe(true);
    expect(taskPointsEdit('2', 2).changed).toBe(false);
  });

  it('rejeita vazio e negativo', () => {
    expect(taskPointsEdit('', 2).valid).toBe(false);
    expect(taskPointsEdit('-1', 2).valid).toBe(false);
    expect(taskPointsEdit('abc', 2).valid).toBe(false);
  });
});
