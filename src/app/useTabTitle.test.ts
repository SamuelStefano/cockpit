import { describe, it, expect } from 'vitest';
import { tabTitle } from './useTabTitle';

describe('tabTitle', () => {
  it('é só "Deck" sem atividade', () => {
    expect(tabTitle(0, 0)).toBe('Deck');
  });

  it('mostra rodando e não-visto separados', () => {
    expect(tabTitle(2, 0)).toBe('▶2 — Deck');
    expect(tabTitle(0, 3)).toBe('●3 — Deck');
    expect(tabTitle(2, 3)).toBe('▶2 ●3 — Deck');
  });
});
