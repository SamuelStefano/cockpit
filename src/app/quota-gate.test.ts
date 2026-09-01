import { describe, it, expect } from 'vitest';
import { quotaGate, rateRejected } from './quota-gate';
import type { PlanUsage } from '../../shared/protocol';

const NOW = 1_800_000_000_000;
const plan = (fiveHour: number, resetsAt: number | null = null): PlanUsage => ({
  fiveHour, sevenDay: 0, resetsAt, sevenDayResetsAt: null, limits: [],
});

describe('rateRejected', () => {
  it('allowed e allowed_warning não são recusa', () => {
    expect(rateRejected({ resetsAt: 0, status: 'allowed' })).toBe(false);
    expect(rateRejected({ resetsAt: 0, status: 'allowed_warning' })).toBe(false);
  });
  it('rejected e limited são recusa', () => {
    expect(rateRejected({ resetsAt: 0, status: 'rejected' })).toBe(true);
    expect(rateRejected({ resetsAt: 0, status: 'limited' })).toBe(true);
  });
  it('sem rate não é recusa', () => {
    expect(rateRejected(null)).toBe(false);
  });
});

describe('quotaGate', () => {
  it('sem plano e sem rate não pausa nem avisa', () => {
    expect(quotaGate(null, null, NOW)).toMatchObject({ paused: false, warn: false, nextResetAt: null });
  });

  // O incidente que motivou o allowed_warning: a 94% o composer travava e o
  // usuário não conseguia mandar nem um prompt simples.
  it('warning avisa mas NÃO trava o envio', () => {
    const g = quotaGate(plan(94), { resetsAt: NOW + 60_000, status: 'allowed_warning' }, NOW);
    expect(g.warn).toBe(true);
    expect(g.paused).toBe(false);
  });

  it('teto do plano (>=99.5) pausa', () => {
    expect(quotaGate(plan(99.5, NOW + 60_000), null, NOW).paused).toBe(true);
    expect(quotaGate(plan(99.4, NOW + 60_000), null, NOW).paused).toBe(false);
  });

  // Sem isto a fila só voltava no próximo push do servidor (até 60s) e o usuário
  // precisava dar F5.
  it('resetsAt vencido des-pausa mesmo com o percentual stale em 100', () => {
    expect(quotaGate(plan(100, NOW - 1), null, NOW).paused).toBe(false);
  });

  // Sem isto a fila drenava no limite e o prompt morria — trabalho perdido.
  it('limite DURO do CLI pausa mesmo com o plano folgado', () => {
    expect(quotaGate(plan(10), { resetsAt: NOW + 60_000, status: 'rejected' }, NOW).paused).toBe(true);
  });

  it('limite duro já vencido não pausa mais', () => {
    expect(quotaGate(plan(10), { resetsAt: NOW - 1, status: 'rejected' }, NOW).paused).toBe(false);
  });

  it('recusa sem resetsAt pausa (não dá pra saber quando volta)', () => {
    expect(quotaGate(plan(10), { resetsAt: 0, status: 'rejected' }, NOW).paused).toBe(true);
  });

  it('nextResetAt é o reset mais próximo ainda no futuro', () => {
    const g = quotaGate(plan(10, NOW + 90_000), { resetsAt: NOW + 30_000, status: 'allowed' }, NOW);
    expect(g.nextResetAt).toBe(NOW + 30_000);
  });

  it('nextResetAt ignora resets já vencidos', () => {
    const g = quotaGate(plan(10, NOW - 10), { resetsAt: NOW + 30_000, status: 'allowed' }, NOW);
    expect(g.nextResetAt).toBe(NOW + 30_000);
    expect(quotaGate(plan(10, NOW - 10), { resetsAt: NOW - 5, status: 'allowed' }, NOW).nextResetAt).toBeNull();
  });

  it('resetsAt do plano tem precedência sobre o do rate no rótulo', () => {
    expect(quotaGate(plan(10, NOW + 90_000), { resetsAt: NOW + 30_000, status: 'allowed' }, NOW).resetsAt).toBe(NOW + 90_000);
    expect(quotaGate(plan(10), { resetsAt: NOW + 30_000, status: 'allowed' }, NOW).resetsAt).toBe(NOW + 30_000);
  });
});
