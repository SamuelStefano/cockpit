import { describe, it, expect } from 'vitest';
import { slidingWindow } from './throttle';

const T0 = 1_800_000_000_000;

describe('slidingWindow', () => {
  it('libera até o limite e barra o excedente', () => {
    const allow = slidingWindow(3, 60_000);
    expect([1, 2, 3].map(() => allow('acc', T0))).toEqual([true, true, true]);
    expect(allow('acc', T0)).toBe(false);
  });

  it('conta por chave — uma conta barrada não afeta a outra', () => {
    const allow = slidingWindow(1, 60_000);
    expect(allow('a', T0)).toBe(true);
    expect(allow('a', T0)).toBe(false);
    expect(allow('b', T0)).toBe(true);
  });

  it('a janela desliza: passado o intervalo, libera de novo', () => {
    const allow = slidingWindow(2, 60_000);
    allow('acc', T0); allow('acc', T0);
    expect(allow('acc', T0 + 59_999)).toBe(false);
    expect(allow('acc', T0 + 60_000)).toBe(true);
  });

  it('barrar não consome cota — a janela não anda com a tentativa negada', () => {
    const allow = slidingWindow(1, 60_000);
    allow('acc', T0);
    for (let i = 1; i <= 5; i++) expect(allow('acc', T0 + i)).toBe(false);
    // O primeiro hit ainda é o de T0, então expira em T0+60s (não empurrado pelas
    // tentativas negadas) — senão quem martela o endpoint se auto-bloqueia pra sempre.
    expect(allow('acc', T0 + 60_000)).toBe(true);
  });

  it('não acumula chaves mortas indefinidamente', () => {
    const allow = slidingWindow(1, 1_000);
    for (let i = 0; i < 1200; i++) allow(`acc-${i}`, T0);
    // Muito depois da janela, uma chamada nova varre o que expirou: as 1200 chaves
    // velhas saem e a cota delas volta ao início.
    allow('gatilho', T0 + 10_000);
    expect(allow('acc-0', T0 + 10_000)).toBe(true);
  });
});
