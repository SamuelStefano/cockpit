import { describe, it, expect } from 'vitest';
import { quotaHoldUntil, burnedByQuota, UNKNOWN_HOLD_MS, PLAN_FULL_PCT } from './quota';

const NOW = 1_800_000_000_000;
const rate = (status: string, resetsAt: number, setAt = NOW) => ({ status, resetsAt, setAt });

describe('quotaHoldUntil', () => {
  it('libera sem sinal algum', () => {
    expect(quotaHoldUntil(null, null, NOW)).toBe(0);
  });

  it('libera com status permitido (inclusive o aviso de proximidade)', () => {
    expect(quotaHoldUntil(rate('allowed', NOW + 60_000), null, NOW)).toBe(0);
    expect(quotaHoldUntil(rate('allowed_warning', NOW + 60_000), null, NOW)).toBe(0);
  });

  it('segura até o reset quando o CLI rejeitou por limite', () => {
    expect(quotaHoldUntil(rate('rejected', NOW + 60_000), null, NOW)).toBe(NOW + 60_000);
  });

  it('solta assim que a janela do rate passa', () => {
    expect(quotaHoldUntil(rate('rejected', NOW - 1), null, NOW)).toBe(0);
  });

  it('limite sem resetsAt segura por uma janela curta, não pra sempre', () => {
    expect(quotaHoldUntil(rate('limited', 0), null, NOW)).toBe(NOW + UNKNOWN_HOLD_MS);
    expect(quotaHoldUntil(rate('limited', 0, NOW - UNKNOWN_HOLD_MS - 1), null, NOW)).toBe(0);
  });

  it('segura com o plano estourado e reset futuro', () => {
    expect(quotaHoldUntil(null, { fiveHour: PLAN_FULL_PCT, sevenDay: 10, resetsAt: NOW + 5000 }, NOW)).toBe(NOW + 5000);
  });

  it('não segura por utilização stale (reset já passou ou desconhecido)', () => {
    expect(quotaHoldUntil(null, { fiveHour: 100, sevenDay: 10, resetsAt: NOW - 1 }, NOW)).toBe(0);
    expect(quotaHoldUntil(null, { fiveHour: 100, sevenDay: 10, resetsAt: null }, NOW)).toBe(0);
  });

  it('não segura abaixo do teto', () => {
    expect(quotaHoldUntil(null, { fiveHour: 98, sevenDay: 10, resetsAt: NOW + 5000 }, NOW)).toBe(0);
  });

  it('fica com o reset mais distante entre os dois sinais', () => {
    const r = rate('rejected', NOW + 1000);
    expect(quotaHoldUntil(r, { fiveHour: 100, sevenDay: 10, resetsAt: NOW + 9000 }, NOW)).toBe(NOW + 9000);
  });
});

describe('burnedByQuota', () => {
  it('não devolve nada sem limite ativo', () => {
    expect(burnedByQuota({ limited: false, tools: 0, text: '' })).toBe(false);
  });

  it('devolve o turno que morreu mudo no limite', () => {
    expect(burnedByQuota({ limited: true, tools: 0, text: '   ' })).toBe(true);
  });

  it('devolve quando o CLI respondeu que a quota acabou', () => {
    expect(burnedByQuota({ limited: true, tools: 0, text: 'Claude AI usage limit reached — resets at 5pm' })).toBe(true);
    expect(burnedByQuota({ limited: true, tools: 2, text: 'Tokens esgotados nesta sessão' })).toBe(true);
  });

  it('preserva turno que produziu trabalho de verdade', () => {
    expect(burnedByQuota({ limited: true, tools: 3, text: '' })).toBe(false);
    expect(burnedByQuota({ limited: true, tools: 0, text: 'Pronto, apliquei a mudança.' })).toBe(false);
  });
});
