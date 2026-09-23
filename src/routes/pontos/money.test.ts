import { describe, it, expect } from 'vitest';
import { brl, brlShort, refMonth, fmtPts, parseBrl, validBrl } from './money';

describe('fmtPts', () => {
  it('inteiro fica sem casa', () => {
    expect(fmtPts(20)).toBe('20');
    expect(fmtPts(0)).toBe('0');
  });
  it('fração arredonda pra 1 casa com vírgula', () => {
    expect(fmtPts(491.38)).toBe('491,4');
    expect(fmtPts(274.23)).toBe('274,2');
    expect(fmtPts(1.5)).toBe('1,5');
  });
});

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

describe('parseBrl', () => {
  it('reads decimals with comma or dot and thousands with dot', () => {
    expect(parseBrl('75')).toBe(75);
    expect(parseBrl('75,50')).toBe(75.5);
    expect(parseBrl('75.5')).toBe(75.5);
    expect(parseBrl('4.000')).toBe(4000);
    expect(parseBrl('R$ 4.000,00')).toBe(4000);
    expect(validBrl('abc')).toBe(false);
    expect(validBrl('0')).toBe(false);
  });
});

describe('brlShort', () => {
  it('rounds to whole reais with pt-BR thousands', () => {
    expect(brlShort(180_000)).toBe('R$ 1.800');
    expect(brlShort(762_549)).toBe('R$ 7.625');
    expect(brlShort(-5_050)).toBe('-R$ 51');
  });
});
