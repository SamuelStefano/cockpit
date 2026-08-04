import { describe, it, expect } from 'vitest';
import { recordFailure } from './breaker';
import { eligible, selectRoute, shouldReturnTo, skipReason, type RouteCandidate } from './select';
import type { ProviderDef } from './catalog';

const NOW = 1_700_000_000_000;

function provider(id: string, authEnv: string | null = 'KEY'): ProviderDef {
  return {
    id, label: id, tier: 'free', baseUrl: authEnv ? `https://${id}.test` : null,
    authEnv, authMode: authEnv ? 'bearer' : 'oauth',
    models: { opus: 'm', sonnet: 'm', haiku: 'm' }, priority: 0, docsUrl: 'https://x.test',
  };
}

const plan = { provider: provider('plan', null), enabled: true, priority: 0 };
const free = { provider: provider('free'), enabled: true, priority: 10 };
const paid = { provider: provider('paid'), enabled: true, priority: 30 };
const all: RouteCandidate[] = [paid, free, plan];

const opts = (over: Partial<Parameters<typeof selectRoute>[1]> = {}) => ({
  now: NOW, breaker: {}, hasCredential: () => true, ...over,
});

describe('selectRoute', () => {
  it('escolhe a menor prioridade', () => {
    expect(selectRoute(all, opts())?.provider.id).toBe('plan');
  });

  it('pula o que está em cooldown', () => {
    const breaker = recordFailure({}, 'plan', 'quota_exhausted', NOW);
    expect(selectRoute(all, opts({ breaker }))?.provider.id).toBe('free');
  });

  it('pula provedor sem credencial', () => {
    const hasCredential = (p: ProviderDef) => p.id !== 'free';
    const breaker = recordFailure({}, 'plan', 'rate_limit', NOW);
    expect(selectRoute(all, opts({ breaker, hasCredential }))?.provider.id).toBe('paid');
  });

  it('pula provedor desligado', () => {
    const cands = [plan, { ...free, enabled: false }, paid];
    const breaker = recordFailure({}, 'plan', 'rate_limit', NOW);
    expect(selectRoute(cands, opts({ breaker }))?.provider.id).toBe('paid');
  });

  it('respeita a lista de exclusão da chamada', () => {
    expect(selectRoute(all, opts({ exclude: ['plan', 'free'] }))?.provider.id).toBe('paid');
  });

  it('devolve null quando tudo está indisponível', () => {
    let breaker = recordFailure({}, 'plan', 'rate_limit', NOW);
    breaker = recordFailure(breaker, 'free', 'quota_exhausted', NOW);
    breaker = recordFailure(breaker, 'paid', 'auth', NOW);
    expect(selectRoute(all, opts({ breaker }))).toBeNull();
  });

  it('provedor volta a ser elegível quando o cooldown vence', () => {
    const breaker = recordFailure({}, 'plan', 'rate_limit', NOW);
    expect(selectRoute(all, opts({ breaker, now: NOW + 6 * 60_000 }))?.provider.id).toBe('plan');
  });

  it('eligible devolve a lista inteira ordenada', () => {
    expect(eligible(all, opts()).map((c) => c.provider.id)).toEqual(['plan', 'free', 'paid']);
  });
});

describe('skipReason', () => {
  it('nomeia o motivo de cada exclusão', () => {
    expect(skipReason({ ...free, enabled: false }, opts())).toBe('disabled');
    expect(skipReason(free, opts({ exclude: ['free'] }))).toBe('excluded');
    expect(skipReason(free, opts({ hasCredential: () => false }))).toBe('no-credential');
    expect(skipReason(free, opts({ breaker: recordFailure({}, 'free', 'auth', NOW) }))).toBe('cooling');
    expect(skipReason(free, opts())).toBeNull();
  });
});

describe('shouldReturnTo', () => {
  it('volta pro plano quando ele sai do cooldown', () => {
    expect(shouldReturnTo('free', all, opts())?.provider.id).toBe('plan');
  });

  it('não troca enquanto a rota melhor continua em cooldown', () => {
    const breaker = recordFailure({}, 'plan', 'quota_exhausted', NOW);
    expect(shouldReturnTo('free', all, opts({ breaker }))).toBeNull();
  });

  it('não troca quando a ativa já é a melhor', () => {
    expect(shouldReturnTo('plan', all, opts())).toBeNull();
  });

  it('nunca desce pra uma rota pior', () => {
    const breaker = recordFailure({}, 'free', 'transient', NOW);
    expect(shouldReturnTo('free', all, opts({ breaker, exclude: ['plan'] }))).toBeNull();
  });
});
