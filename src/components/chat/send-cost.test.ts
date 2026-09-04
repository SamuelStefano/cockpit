import { describe, it, expect } from 'vitest';
import { composerCost, NOTICE_PCT, CONFIRM_PCT } from './send-cost';
import type { PlanUsage } from '../../../shared/protocol';

const NOW = 1_788_500_000_000;
const H3 = 3 * 60 * 60_000;
const plan = (fiveHour: number): PlanUsage => ({ fiveHour, sevenDay: 0, resetsAt: NOW + 3_600_000, sevenDayResetsAt: NOW, limits: [] });

describe('composerCost', () => {
  it('cala a boca no caso comum: sessão viva, cache quente', () => {
    expect(composerCost({ ctxTokens: 120_000, lastUsageAt: NOW - 30_000, planUsage: plan(10), now: NOW })).toBeNull();
  });

  it('cala a boca em sessão nova', () => {
    expect(composerCost({ ctxTokens: 0, planUsage: plan(10), now: NOW })).toBeNull();
  });

  // O caso do incidente: a MESMA sessão, só que parada há horas.
  it('avisa e pede confirmação quando o cache esfriou numa sessão grande', () => {
    const r = composerCost({ ctxTokens: 681_362, lastUsageAt: NOW - H3, planUsage: plan(20), now: NOW })!;
    expect(r.notice).toBe(true);
    expect(r.confirm).toBe(true);
    expect(r.cost.pctOfWindow).toBeGreaterThanOrEqual(CONFIRM_PCT);
    expect(r.label).toContain('cache frio');
  });

  it('a mesma sessão quente não pede confirmação', () => {
    const r = composerCost({ ctxTokens: 681_362, lastUsageAt: NOW - 30_000, planUsage: plan(20), now: NOW });
    expect(r?.confirm ?? false).toBe(false);
  });

  it('pede confirmação quando não cabe na janela, mesmo sendo barato', () => {
    const r = composerCost({ ctxTokens: 200_000, lastUsageAt: NOW - H3, planUsage: plan(99), now: NOW })!;
    expect(r.fits).toBe(false);
    expect(r.confirm).toBe(true);
  });

  it('sem leitura de cota ainda avisa pelo tamanho', () => {
    const r = composerCost({ ctxTokens: 400_000, lastUsageAt: NOW - H3, planUsage: null, now: NOW })!;
    expect(r.fits).toBe(true);
    expect(r.cost.pctOfWindow).toBeGreaterThan(NOTICE_PCT);
  });
});

// Num F5 o mapa de lastUsageAt nasce vazio. Sem fallback, toda sessão aparecia
// fria logo após recarregar — falso positivo que ensina a ignorar o aviso.
describe('composerCost — temperatura desconhecida', () => {
  it('sem lastUsageAt trata como frio (o caso do incidente: sessão parada há horas)', () => {
    const r = composerCost({ ctxTokens: 681_362, planUsage: null, now: NOW })!;
    expect(r.cost.cold).toBe(true);
  });

  it('com o mtime recente da sessão, não grita', () => {
    expect(composerCost({ ctxTokens: 681_362, lastUsageAt: NOW - 20_000, planUsage: null, now: NOW })).toBeNull();
  });
});
