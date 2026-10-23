import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlanUsage } from '../../shared/protocol';

interface Fakes {
  rate: { status: string; resetsAt: number; setAt: number } | null;
  usage: PlanUsage | null;
  refreshes: number;
  readAt: number;
}
const f: Fakes = { rate: null, usage: null, refreshes: 0, readAt: 0 };

vi.mock('./rate', () => ({ getRateSnapshot: () => f.rate }));
vi.mock('./usage-plan', () => ({
  getLastPlanUsage: () => f.usage,
  getPlanUsageReadAt: () => f.readAt,
  requestPlanUsageRefresh: () => { f.refreshes++; },
}));

import { quotaHoldUntil, quotaHold, planLimited, burnedByQuota, UNKNOWN_HOLD_MS, PLAN_FULL_PCT } from './quota';

const NOW = 1_800_000_000_000;

beforeEach(() => {
  Object.assign(f, { rate: null, usage: null, refreshes: 0, readAt: 0 });
});
const rate = (status: string, resetsAt: number, setAt = NOW) => ({ status, resetsAt, setAt });
const plan = (fiveHour: number, resetsAt: number | null): PlanUsage => ({ fiveHour, sevenDay: 10, resetsAt, sevenDayResetsAt: null, limits: [] });

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
    expect(quotaHoldUntil(null, plan(PLAN_FULL_PCT, NOW + 5000), NOW)).toBe(NOW + 5000);
  });

  it('não segura por utilização stale (reset já passou ou desconhecido)', () => {
    expect(quotaHoldUntil(null, plan(100, NOW - 1), NOW)).toBe(0);
    expect(quotaHoldUntil(null, plan(100, null), NOW)).toBe(0);
  });

  it('não segura abaixo do teto', () => {
    expect(quotaHoldUntil(null, plan(98, NOW + 5000), NOW)).toBe(0);
  });

  it('fica com o reset mais distante entre os dois sinais', () => {
    const r = rate('rejected', NOW + 1000);
    expect(quotaHoldUntil(r, plan(100, NOW + 9000), NOW)).toBe(NOW + 9000);
  });
});

describe('quotaHoldUntil com usage mais novo que o rate_limit_event', () => {
  const SET = NOW - 600_000;
  const FRESH = NOW - 1000;

  it('sem resetsAt, usage novo livre solta', () => {
    expect(quotaHoldUntil(rate('rejected', 0, SET), plan(1, NOW + 5000), NOW, FRESH)).toBe(0);
  });

  it('usage mais velho que o evento nao solta', () => {
    expect(quotaHoldUntil(rate('rejected', 0, SET), plan(1, NOW + 5000), NOW, SET - 1000)).toBe(SET + UNKNOWN_HOLD_MS);
  });

  it('usage novo em 100% continua segurando', () => {
    expect(quotaHoldUntil(rate('rejected', 0, SET), plan(100, null), NOW, FRESH)).toBe(SET + UNKNOWN_HOLD_MS);
  });

  it('99% arredondado nao solta rejected com resetsAt conhecido', () => {
    const r = rate('rejected', NOW + 9000, SET);
    expect(quotaHoldUntil(r, plan(99, NOW + 9000), NOW, FRESH)).toBe(NOW + 9000);
  });

  it('com resetsAt conhecido so solta quando a janela virou', () => {
    const r = rate('rejected', NOW + 9000, SET);
    expect(quotaHoldUntil(r, plan(1, NOW + 9000), NOW, FRESH)).toBe(NOW + 9000);
    expect(quotaHoldUntil(r, plan(1, NOW + 5 * 3_600_000), NOW, FRESH)).toBe(0);
  });

  it('pos-reset: usage novo em 0% com resetsAt nulo solta evento rejeitado com resetsAt futuro', () => {
    const r = rate('rejected', NOW + 3_600_000, SET);
    const u = { ...plan(0, null), sevenDay: 53 };
    expect(quotaHoldUntil(r, u, NOW, FRESH)).toBe(0);
  });

  it('pos-reset: usage mais velho que o evento continua segurando', () => {
    const r = rate('rejected', NOW + 3_600_000, SET);
    const u = { ...plan(0, null), sevenDay: 53 };
    expect(quotaHoldUntil(r, u, NOW, SET - 1000)).toBe(NOW + 3_600_000);
  });

  it('pos-reset: limite em 96% continua segurando', () => {
    const r = rate('rejected', NOW + 3_600_000, SET);
    const limits = [{ id: 'x', label: 'x', pct: 96, resetsAt: null, severity: 'critical' as const, scoped: false }];
    expect(quotaHoldUntil(r, { ...plan(0, null), sevenDay: 53, limits }, NOW, FRESH)).toBe(NOW + 3_600_000);
  });

  it('sevenDay alto ou qualquer limite alto, escopado ou nao, nao solta', () => {
    const r = rate('rejected', 0, SET);
    expect(quotaHoldUntil(r, { ...plan(1, null), sevenDay: 100 }, NOW, FRESH)).toBe(SET + UNKNOWN_HOLD_MS);
    const limits = [{ id: 'x', label: 'x', pct: 100, resetsAt: null, severity: 'critical' as const, scoped: false }];
    expect(quotaHoldUntil(r, { ...plan(1, null), limits }, NOW, FRESH)).toBe(SET + UNKNOWN_HOLD_MS);
    expect(quotaHoldUntil(r, { ...plan(1, null), limits: [{ ...limits[0], scoped: true }] }, NOW, FRESH)).toBe(SET + UNKNOWN_HOLD_MS);
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
  });

  it('devolve pelo texto mesmo sem rate_limit_event (o CLI só imprime e sai)', () => {
    expect(burnedByQuota({ limited: false, tools: 0, text: 'Claude usage limit reached. Resets at 10pm.' })).toBe(true);
    expect(burnedByQuota({ limited: false, tools: 0, text: 'limite de uso atingido' })).toBe(true);
  });

  it('preserva turno que produziu trabalho de verdade', () => {
    expect(burnedByQuota({ limited: true, tools: 3, text: '' })).toBe(false);
    expect(burnedByQuota({ limited: true, tools: 0, text: 'Pronto, apliquei a mudança.' })).toBe(false);
  });

  it('não devolve turno que rodou tool, mesmo com o texto do limite', () => {
    expect(burnedByQuota({ limited: true, tools: 2, text: 'Tokens esgotados nesta sessão' })).toBe(false);
    expect(burnedByQuota({ limited: false, tools: 9, text: 'corrigi o caso de limite de uso' })).toBe(false);
  });

  it('não confunde uma RESPOSTA sobre limite de uso com a bailout do CLI', () => {
    const ensaio = `O limite de uso do plano funciona assim: ${'x'.repeat(500)}`;
    expect(burnedByQuota({ limited: false, tools: 0, text: ensaio })).toBe(false);
  });
});

// `quotaHold` é o teto do plano visto pela fila: enquanto segura, nada drena.
describe('quotaHold', () => {
  it('sem teto não segura nem pede refresh de usage', () => {
    expect(quotaHold(NOW)).toBe(0);
    expect(f.refreshes).toBe(0);
  });

  it('com teto segura até o reset', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    expect(quotaHold(NOW)).toBe(NOW + 3_600_000);
  });

  it('pede refresh do usage pra soltar a fila assim que a janela virar', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    quotaHold(NOW);
    expect(f.refreshes).toBe(1);
  });
});

describe('planLimited', () => {
  it('verdadeiro com teto batido', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    expect(planLimited(NOW)).toBe(true);
  });

  it('falso sem teto', () => {
    expect(planLimited(NOW)).toBe(false);
  });
});
