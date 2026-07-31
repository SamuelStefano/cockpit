import { describe, it, expect } from 'vitest';
import { saturation, canHandoff, SATURATED_PCT } from './saturation';

describe('saturation', () => {
  it('fica quieta enquanto a sessão tem folga', () => {
    expect(saturation(0)).toBeNull();
    expect(saturation(100_000)).toBeNull();
    expect(saturation(158_000)).toBeNull();
  });

  it('acende exatamente no limiar', () => {
    expect(saturation(SATURATED_PCT * 2_000)?.pct).toBe(SATURATED_PCT);
  });

  it('escala pra crítico perto do teto', () => {
    expect(saturation(170_000)?.critical).toBe(false);
    expect(saturation(190_000)?.critical).toBe(true);
  });

  it('formata os tokens em milhares pro rótulo', () => {
    expect(saturation(166_507)?.k).toBe('167');
  });
});

describe('canHandoff', () => {
  it('exige sessão já persistida no servidor', () => {
    expect(canHandoff('new-abc', false)).toBe(false);
    expect(canHandoff(undefined, false)).toBe(false);
    expect(canHandoff('107cef43-uuid', false)).toBe(true);
  });

  it('bloqueia enquanto uma migração está em voo', () => {
    expect(canHandoff('107cef43-uuid', true)).toBe(false);
  });
});
