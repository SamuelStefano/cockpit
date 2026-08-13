import { describe, it, expect } from 'vitest';
import { routeBanner, quotaBlocksInput, tierLabel, planRoute, activeRoute, hhmm } from './route-status';
import type { RoutesSnapshot, RouteView } from '../../../shared/protocol';

function route(over: Partial<RouteView> & { id: string }): RouteView {
  return {
    label: over.id, tier: 'free', priority: 10, enabled: true, active: false, configured: true,
    authEnv: 'X_KEY', cooldownUntil: 0, lastKind: null, custom: false, docsUrl: 'https://x', models: 'a/b/c',
    skip: null, ...over,
  };
}

const NOW = 1_700_000_000_000;

function snap(over: Partial<RoutesSnapshot> = {}): RoutesSnapshot {
  return {
    enabled: true,
    cascadeId: null,
    activeId: 'qwen',
    routes: [
      route({ id: 'anthropic-plan', label: 'Plano Anthropic', tier: 'plan', priority: 0 }),
      route({ id: 'qwen', label: 'Qwen Coder', active: true }),
    ],
    hasFallback: false,
    ...over,
  };
}

describe('routeBanner', () => {
  it('não mostra nada sem snapshot ou com roteador desligado', () => {
    expect(routeBanner(null, NOW)).toBeNull();
    expect(routeBanner(snap({ enabled: false }), NOW)).toBeNull();
  });

  it('não mostra nada rodando no próprio plano (estado normal é silêncio)', () => {
    expect(routeBanner(snap({ activeId: 'anthropic-plan' }), NOW)).toBeNull();
  });

  it('mostra o provedor em uso quando saiu do plano', () => {
    const b = routeBanner(snap(), NOW)!;
    expect(b.label).toBe('Qwen Coder');
    expect(b.tier).toBe('free');
  });

  it('diz a hora de volta quando o plano está em cooldown', () => {
    const plan = route({ id: 'anthropic-plan', label: 'Plano', tier: 'plan', priority: 0, cooldownUntil: NOW + 3_600_000, lastKind: 'quota_exhausted' });
    const b = routeBanner(snap({ routes: [plan, route({ id: 'qwen', label: 'Qwen', active: true })] }), NOW)!;
    expect(b.backAt).toBe(hhmm(NOW + 3_600_000));
    expect(b.detail).toContain('Tokens do plano esgotados');
    expect(b.detail).toContain(b.backAt!);
  });

  // Cooldown já vencido não pode virar "volta às <hora no passado>".
  it('ignora cooldown expirado', () => {
    const plan = route({ id: 'anthropic-plan', tier: 'plan', priority: 0, cooldownUntil: NOW - 1, lastKind: 'rate_limit' });
    const b = routeBanner(snap({ routes: [plan, route({ id: 'qwen', active: true })] }), NOW)!;
    expect(b.backAt).toBeNull();
    expect(b.detail).toContain('próximo turno livre');
  });

  it('traduz o motivo de cada tipo de falha do plano', () => {
    const kinds: Array<[string, string]> = [
      ['quota_exhausted', 'Tokens do plano esgotados'],
      ['rate_limit', 'Plano em rate limit'],
      ['auth', 'Plano sem credencial válida'],
      ['transient', 'Fora do plano'],
    ];
    for (const [kind, expected] of kinds) {
      const plan = route({ id: 'anthropic-plan', tier: 'plan', priority: 0, lastKind: kind });
      const b = routeBanner(snap({ routes: [plan, route({ id: 'qwen', active: true })] }), NOW)!;
      expect(b.detail, kind).toContain(expected);
    }
  });

  it('sobrevive a um activeId que não existe na lista', () => {
    expect(routeBanner(snap({ activeId: 'sumiu' }), NOW)).toBeNull();
  });
});

// O input só trava por quota quando NÃO há rota alternativa rodando.
describe('quotaBlocksInput', () => {
  it('trava no plano e sem roteador', () => {
    expect(quotaBlocksInput(null)).toBe(true);
    expect(quotaBlocksInput(snap({ activeId: 'anthropic-plan' }))).toBe(true);
    expect(quotaBlocksInput(snap({ enabled: false }))).toBe(true);
  });

  it('libera com rota alternativa ativa', () => {
    expect(quotaBlocksInput(snap())).toBe(false);
  });

  // A troca só acontece no servidor quando o turno dispara: travar o campo até lá
  // deixaria o usuário sem escrever tendo um provedor pronto do outro lado.
  it('libera ainda no plano quando existe fallback pronto', () => {
    expect(quotaBlocksInput(snap({ activeId: 'anthropic-plan', hasFallback: true }))).toBe(false);
  });

  it('fallback não vale com o roteador desligado', () => {
    expect(quotaBlocksInput(snap({ activeId: 'anthropic-plan', enabled: false, hasFallback: true }))).toBe(true);
  });
});

describe('helpers', () => {
  it('traduz os tiers e devolve cru o desconhecido', () => {
    expect(tierLabel('free')).toBe('grátis');
    expect(tierLabel('cheap')).toBe('barato');
    expect(tierLabel('paid')).toBe('pago');
    expect(tierLabel('exotico')).toBe('exotico');
  });

  it('acha o plano e a rota ativa', () => {
    expect(planRoute(snap())!.id).toBe('anthropic-plan');
    expect(activeRoute(snap())!.id).toBe('qwen');
  });
});
