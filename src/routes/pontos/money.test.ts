import { describe, it, expect } from 'vitest';
import { brl, refMonth } from './money';

describe('brl', () => {
  it('formata centavos em pt-BR', () => {
    expect(brl(0)).toBe('R$ 0,00');
    expect(brl(5)).toBe('R$ 0,05');
    expect(brl(2056750)).toBe('R$ 20.567,50');
    expect(brl(100)).toBe('R$ 1,00');
  });
  it('trata negativo', () => {
    expect(brl(-100)).toBe('-R$ 1,00');
  });
});

describe('refMonth', () => {
  it('encurta o mês de referência', () => {
    expect(refMonth('2026-07')).toBe('jul/26');
    expect(refMonth('2026-01-15')).toBe('jan/26');
  });
  it('devolve cru quando inválido', () => {
    expect(refMonth('xxxx')).toBe('xxxx');
  });
});
