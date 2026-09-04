import { describe, it, expect } from 'vitest';
import { estimateSendCost, fitsInWindow, costLabel, DEFAULT_WINDOW_WEIGHTED } from './send-cost';

const H3 = 3 * 60 * 60_000;
const NOW = 1_788_500_000_000;

// Os cinco envios que levaram a janela de 20% a 100% em 04/09/2026 (peso medido no
// ~/.cockpit/cockpit.db). A estimativa arredonda pra cima de propósito, então a
// tolerância é de 10% e SÓ pra cima — estimar abaixo do real é o modo de falha
// que este arquivo existe pra impedir.
const INCIDENTE = [
  { nome: '42b71e92 fable', ctx: 681_362, medido: 838_000 },
  { nome: '2b09d754 opus', ctx: 314_832, medido: 380_000 },
  { nome: 'be8d6e73 opus', ctx: 779_566, medido: 958_000 },
  { nome: '90d4d02a opus', ctx: 631_342, medido: 773_000 },
  { nome: '42b71e92 fable 2', ctx: 691_139, medido: 846_000 },
];

describe('estimateSendCost — contra o incidente de 04/09/2026', () => {
  for (const { nome, ctx, medido } of INCIDENTE) {
    it(`${nome}: estima o peso do envio frio dentro de +10% do medido`, () => {
      const c = estimateSendCost({ ctxTokens: ctx, ts: NOW - H3, model: null }, NOW);
      expect(c.cold).toBe(true);
      expect(c.weighted).toBeGreaterThanOrEqual(medido);
      expect(c.weighted).toBeLessThanOrEqual(medido * 1.1);
    });
  }

  it('a soma dos cinco envios estoura a janela sozinha', () => {
    const total = INCIDENTE.reduce((a, { ctx }) => a + estimateSendCost({ ctxTokens: ctx, ts: NOW - H3, model: null }, NOW).weighted, 0);
    expect(total).toBeGreaterThan(DEFAULT_WINDOW_WEIGHTED * 0.55);
  });
});

describe('estimateSendCost — frio vs quente', () => {
  it('cache quente custa ~12x menos no mesmo contexto', () => {
    const frio = estimateSendCost({ ctxTokens: 690_000, ts: NOW - H3, model: null }, NOW);
    const quente = estimateSendCost({ ctxTokens: 690_000, ts: NOW - 30_000, model: null }, NOW);
    expect(quente.cold).toBe(false);
    expect(frio.weighted / quente.weighted).toBeGreaterThan(10);
  });

  it('o corte é o TTL, não a atividade em si', () => {
    const ttl = 5 * 60_000;
    expect(estimateSendCost({ ctxTokens: 1000, ts: NOW - ttl + 1, model: null }, NOW).cold).toBe(false);
    expect(estimateSendCost({ ctxTokens: 1000, ts: NOW - ttl - 1, model: null }, NOW).cold).toBe(true);
  });

  it('sessão nova (sem amostra) não estima zero nem assusta', () => {
    const c = estimateSendCost(null, NOW);
    expect(c.cold).toBe(false);
    expect(c.ctxTokens).toBe(0);
    expect(c.pctOfWindow).toBeLessThan(1);
  });

  it('amostra com ctx zerado cai no mesmo caminho da sessão nova', () => {
    expect(estimateSendCost({ ctxTokens: 0, ts: 0, model: null }, NOW).pctOfWindow).toBeLessThan(1);
  });
});

describe('fitsInWindow', () => {
  const caro = estimateSendCost({ ctxTokens: 780_000, ts: NOW - H3, model: null }, NOW);

  it('recusa quando o envio não cabe no que sobrou', () => {
    expect(fitsInWindow(caro, 95)).toBe(false);
  });

  it('aceita com janela folgada', () => {
    expect(fitsInWindow(caro, 20)).toBe(true);
  });

  it('sem leitura de cota não trava o envio', () => {
    expect(fitsInWindow(caro, null)).toBe(true);
    expect(fitsInWindow(caro, NaN)).toBe(true);
  });

  it('janela em 100% recusa até o envio mais barato', () => {
    expect(fitsInWindow(estimateSendCost(null, NOW), 100)).toBe(false);
  });
});

describe('costLabel', () => {
  it('diz o percentual, o contexto e a temperatura do cache', () => {
    const l = costLabel(estimateSendCost({ ctxTokens: 681_362, ts: NOW - H3, model: null }, NOW));
    expect(l).toContain('681k');
    expect(l).toContain('cache frio');
    expect(l).toMatch(/~1[23]\.\d% da janela/);
  });
});
