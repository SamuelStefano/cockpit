import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlanUsage } from '../../shared/protocol';

interface Fakes {
  rate: { status: string; resetsAt: number; setAt: number } | null;
  usage: PlanUsage | null;
  planRoute: boolean;
  fallback: boolean;
  switched: boolean;
  refreshes: number;
  switchCalls: number[];
}
const f: Fakes = { rate: null, usage: null, planRoute: true, fallback: false, switched: false, refreshes: 0, switchCalls: [] };

vi.mock('./rate', () => ({ getRateSnapshot: () => f.rate }));
vi.mock('./usage-plan', () => ({
  getLastPlanUsage: () => f.usage,
  requestPlanUsageRefresh: () => { f.refreshes++; },
}));
vi.mock('../router/state', () => ({
  isPlanRoute: () => f.planRoute,
  hasFallbackRoute: () => f.fallback,
  switchOnPlanExhausted: (until: number) => { f.switchCalls.push(until); return f.switched ? { to: 'zai-glm' } : null; },
}));

import { quotaHoldUntil, quotaHold, planLimited, burnedByQuota, UNKNOWN_HOLD_MS, PLAN_FULL_PCT } from './quota';

const NOW = 1_800_000_000_000;

beforeEach(() => {
  Object.assign(f, { rate: null, usage: null, planRoute: true, fallback: false, switched: false, refreshes: 0, switchCalls: [] });
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

describe('quotaHoldUntil com rota alternativa', () => {
  it('não segura a fila quando o roteador já saiu do plano', () => {
    const hold = quotaHoldUntil(rate('rate_limited', NOW + 3_600_000), plan(100, NOW + 3_600_000), NOW, false);
    expect(hold).toBe(0);
  });

  it('segue segurando enquanto a rota ativa é o plano', () => {
    const hold = quotaHoldUntil(rate('rate_limited', NOW + 3_600_000), null, NOW, true);
    expect(hold).toBe(NOW + 3_600_000);
  });
});

// `quotaHold` é o ponto onde o teto do plano deixa de ser "dormir até o reset" e
// vira "trocar de provedor". É o que faz a fila drenar de madrugada.
describe('quotaHold', () => {
  it('sem teto não segura nem pede refresh de usage', () => {
    expect(quotaHold(NOW)).toBe(0);
    expect(f.refreshes).toBe(0);
    expect(f.switchCalls).toEqual([]);
  });

  it('sem rota alternativa mantém o hold antigo (dormir é melhor que queimar prompt)', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    expect(quotaHold(NOW)).toBe(NOW + 3_600_000);
    expect(f.switchCalls).toEqual([]);
  });

  it('pede refresh do usage pra soltar a fila assim que a janela virar', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    quotaHold(NOW);
    expect(f.refreshes).toBe(1);
  });

  it('com fallback pronto troca de rota e libera a fila na hora', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    f.fallback = true;
    f.switched = true;
    expect(quotaHold(NOW)).toBe(0);
    expect(f.switchCalls).toEqual([NOW + 3_600_000]);
  });

  // A troca pode falhar entre o "tem fallback" e o switch (chave sumiu, breaker
  // abriu). Nesse caso segurar é o certo — soltar dispararia contra a rota morta.
  it('fallback que não conseguiu trocar volta a segurar', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    f.fallback = true;
    f.switched = false;
    expect(quotaHold(NOW)).toBe(NOW + 3_600_000);
  });

  it('fora do plano nunca segura (rate/usage são da conta Anthropic)', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    f.planRoute = false;
    expect(quotaHold(NOW)).toBe(0);
  });
});

// `planLimited` alimenta o breaker do roteador: atribuir um teto da Anthropic ao
// provedor da vez abriria o breaker DELE por um fato que não é dele.
describe('planLimited', () => {
  it('verdadeiro só no plano e com teto batido', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    expect(planLimited(NOW)).toBe(true);
  });

  it('falso fora do plano, mesmo com a Anthropic no teto', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    f.planRoute = false;
    expect(planLimited(NOW)).toBe(false);
  });

  it('falso no plano sem teto', () => {
    expect(planLimited(NOW)).toBe(false);
  });

  it('não troca de rota (só reporta)', () => {
    f.rate = rate('rejected', NOW + 3_600_000);
    f.fallback = true;
    f.switched = true;
    planLimited(NOW);
    expect(f.switchCalls).toEqual([]);
  });
});
