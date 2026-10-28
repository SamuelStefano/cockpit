import { describe, it, expect } from 'vitest';
import { isFreeTextOption } from './free-text-option';

describe('isFreeTextOption', () => {
  it.each(['Outro', 'Outra ideia…', 'Escreva a sua', 'Other', 'Write your own', 'Digite aqui', 'Something else'])('matches %s', (l) => {
    expect(isFreeTextOption(l)).toBe(true);
  });
  it.each(['Aprovar', 'Cortar', 'Aprovar com outro ajuste', 'Pedir um novo mockup antes'])('ignores %s', (l) => {
    expect(isFreeTextOption(l)).toBe(false);
  });
});
