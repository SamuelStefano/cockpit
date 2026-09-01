import { describe, it, expect } from 'vitest';
import { fmtTaskCost } from './task-cost';

describe('fmtTaskCost', () => {
  it('distingue não medido de medido em zero', () => {
    expect(fmtTaskCost(undefined)).toBe('—');
    expect(fmtTaskCost(0)).toBe('grátis');
  });

  // As duas cópias locais imprimiam três casas em qualquer valor acima de um centavo:
  // a mesma task custava "$1911.210" aqui e "$1.9k" na sidebar.
  it('delega o valor ao formatador canônico', () => {
    expect(fmtTaskCost(0.0042)).toBe('$0.0042');
    expect(fmtTaskCost(12.5)).toBe('$12.50');
    expect(fmtTaskCost(1911.21)).toBe('$1.9k');
  });
});
