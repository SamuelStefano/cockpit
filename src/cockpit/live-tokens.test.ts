import { describe, it, expect } from 'vitest';
import { liveTokens } from './live-tokens';

describe('liveTokens', () => {
  it('usa o piso real quando a estimativa por chars é menor (centenas vs milhares)', () => {
    expect(liveTokens(180, 32000)).toBe(32000);
  });

  it('deixa a estimativa crescer acima do piso entre chamadas', () => {
    expect(liveTokens(33000, 32000)).toBe(33000);
  });

  it('não regride: piso real domina mesmo com estimativa zerada', () => {
    expect(liveTokens(0, 32000)).toBe(32000);
  });

  it('turno novo (ambos zero) começa em zero', () => {
    expect(liveTokens(0, 0)).toBe(0);
  });
});
