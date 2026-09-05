import { describe, it, expect } from 'vitest';
import { relPast, fmtCost, fmtStamp } from './format';

const now = Date.UTC(2026, 0, 15, 12, 0, 0);
const ago = (ms: number) => now - ms;
const MIN = 60_000, H = 60 * MIN, D = 24 * H;

describe('relPast', () => {
  it('sub-minuto = agora', () => {
    expect(relPast(ago(0), now)).toBe('agora');
    expect(relPast(ago(59_000), now)).toBe('agora');
  });

  it('minutos até a hora cheia', () => {
    expect(relPast(ago(MIN), now)).toBe('1min');
    expect(relPast(ago(59 * MIN), now)).toBe('59min');
  });

  // Com Math.round (o que src/lib/time.ts fazia) isto imprimia "60min", um rótulo que
  // não existe na escala: passa direto de 59min para 1h.
  it('59min30s ainda é 59min, nunca "60min"', () => {
    expect(relPast(ago(59 * MIN + 30_000), now)).toBe('59min');
    expect(relPast(ago(60 * MIN), now)).toBe('1h');
  });

  it('horas até o dia cheio', () => {
    expect(relPast(ago(H), now)).toBe('1h');
    expect(relPast(ago(23 * H), now)).toBe('23h');
  });

  it('dias até a semana cheia', () => {
    expect(relPast(ago(D), now)).toBe('1d');
    expect(relPast(ago(6 * D), now)).toBe('6d');
  });

  it('semanas a partir de sete dias', () => {
    expect(relPast(ago(7 * D), now)).toBe('1sem');
    expect(relPast(ago(40 * D), now)).toBe('5sem');
  });

  // O mtime vindo do servidor pode estar à frente do relógio do navegador; sem o piso
  // em "agora" a sidebar mostraria "-1min".
  it('instante no futuro não vira número negativo', () => {
    expect(relPast(now + 5 * MIN, now)).toBe('agora');
  });

  // As quatro cópias renderizavam o MESMO instante de formas diferentes: a sidebar dizia
  // "ontem", /pontos dizia "há 2d" e /uso dizia "1d". Um único valor para cada faixa é o
  // ponto deste módulo.
  it('não emite nenhuma das formas antigas', () => {
    const amostras = [0, 30_000, 5 * MIN, 90 * MIN, 30 * H, 36 * H, 3 * D, 20 * D];
    for (const ms of amostras) {
      const out = relPast(ago(ms), now);
      expect(out).not.toMatch(/há |atrás|ontem/);
    }
    expect(relPast(ago(36 * H), now)).toBe('1d');
  });
});

describe('fmtCost', () => {
  it('zero e negativo são $0', () => {
    expect(fmtCost(0)).toBe('$0');
    expect(fmtCost(-5)).toBe('$0');
  });

  it('sub-centavo mantém a quarta casa', () => {
    expect(fmtCost(0.0042)).toBe('$0.0042');
    expect(fmtCost(0.0001)).toBe('$0.0001');
  });

  // row-meta.ts imprimia "$0.0050" e /uso imprimia "$0.005" para o mesmo custo.
  it('sub-centavo corta o zero à direita', () => {
    expect(fmtCost(0.005)).toBe('$0.005');
    expect(fmtCost(0.001)).toBe('$0.001');
  });

  // Abaixo de um décimo de milésimo não sobra dígito significativo nas 4 casas; melhor
  // "$0" do que "$0." quebrado pelo corte de zeros.
  it('valor irrelevante colapsa em $0 sem sobrar ponto', () => {
    expect(fmtCost(0.00001)).toBe('$0');
  });

  it('três casas abaixo de um dólar', () => {
    expect(fmtCost(0.025)).toBe('$0.025');
    expect(fmtCost(0.5)).toBe('$0.500');
  });

  it('duas casas no uso do dia a dia', () => {
    expect(fmtCost(1)).toBe('$1.00');
    expect(fmtCost(4.2)).toBe('$4.20');
    expect(fmtCost(42.5)).toBe('$42.50');
  });

  it('dólares inteiros a partir de $100', () => {
    expect(fmtCost(100)).toBe('$100');
    expect(fmtCost(197.77)).toBe('$198');
  });

  it('compacta em k a partir de $1000', () => {
    expect(fmtCost(1911.21)).toBe('$1.9k');
    expect(fmtCost(1234.6)).toBe('$1.2k');
  });

  // Sem a fronteira em 999.5 o Math.round imprimia "$1000".
  it('nunca imprime "$1000"', () => {
    expect(fmtCost(999.99)).toBe('$1.0k');
    expect(fmtCost(999.5)).toBe('$1.0k');
    expect(fmtCost(999.4)).toBe('$999');
  });

  // O harness imprimia "$1911.210" (três casas sempre) enquanto a sidebar imprimia
  // "$1.9k" e /uso "$1911" — o mesmo custo em três formatos na mesma tela.
  it('nunca imprime três casas em valor alto', () => {
    expect(fmtCost(1911.21)).not.toBe('$1911.210');
    expect(fmtCost(12.5)).not.toBe('$12.500');
  });
});

describe('fmtStamp', () => {
  it('dia/mes hora:min no ano corrente', () => {
    expect(fmtStamp(new Date(2026, 7, 12, 9, 5).getTime(), now)).toBe('12/08 09:05');
  });

  it('acrescenta o ano quando o instante nao e do ano corrente', () => {
    expect(fmtStamp(new Date(2025, 11, 31, 23, 59).getTime(), now)).toBe('31/12/2025 23:59');
  });
});
