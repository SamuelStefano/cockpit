import { describe, it, expect } from 'vitest';
import { cooldownFor, isOpen, openUntil, prune, recordFailure, recordSuccess, type BreakerState } from './breaker';

const NOW = 1_700_000_000_000;

describe('cooldownFor', () => {
  it('escala exponencialmente na falha consecutiva', () => {
    expect(cooldownFor('transient', 1)).toBe(30_000);
    expect(cooldownFor('transient', 2)).toBe(60_000);
    expect(cooldownFor('transient', 3)).toBe(120_000);
  });

  it('respeita o teto por tipo', () => {
    expect(cooldownFor('transient', 99)).toBe(5 * 60_000);
    expect(cooldownFor('quota_exhausted', 99)).toBe(24 * 3_600_000);
  });

  it('dica do provedor manda quando existe', () => {
    expect(cooldownFor('rate_limit', 5, 90_000)).toBe(90_000);
  });

  it('dica também é limitada pelo teto do tipo', () => {
    expect(cooldownFor('rate_limit', 1, 99 * 3_600_000)).toBe(60 * 60_000);
  });

  it('ok não gera cooldown', () => {
    expect(cooldownFor('ok', 3)).toBe(0);
  });
});

describe('recordFailure', () => {
  it('abre o breaker e conta a falha', () => {
    const s = recordFailure({}, 'zai', 'rate_limit', NOW);
    expect(isOpen(s, 'zai', NOW)).toBe(true);
    expect(isOpen(s, 'zai', NOW + 6 * 60_000)).toBe(false);
    expect(s.zai.fails).toBe(1);
  });

  it('não encurta um cooldown mais longo já vigente', () => {
    let s = recordFailure({}, 'zai', 'quota_exhausted', NOW);
    const long = s.zai.openUntil;
    s = recordFailure(s, 'zai', 'transient', NOW);
    expect(s.zai.openUntil).toBe(long);
    expect(s.zai.lastKind).toBe('transient');
  });

  it('é puro: não muta o estado recebido', () => {
    const s: BreakerState = {};
    recordFailure(s, 'zai', 'transient', NOW);
    expect(s).toEqual({});
  });

  it('ok não muda nada', () => {
    const s: BreakerState = {};
    expect(recordFailure(s, 'zai', 'ok', NOW)).toBe(s);
  });
});

describe('recordSuccess', () => {
  it('zera o provedor que voltou a funcionar', () => {
    const s = recordFailure({}, 'zai', 'transient', NOW);
    expect(recordSuccess(s, 'zai')).toEqual({});
  });

  it('devolve a mesma referência quando não havia nada', () => {
    const s: BreakerState = {};
    expect(recordSuccess(s, 'zai')).toBe(s);
  });
});

describe('openUntil e prune', () => {
  it('openUntil zera depois do vencimento', () => {
    const s = recordFailure({}, 'zai', 'transient', NOW);
    expect(openUntil(s, 'zai', NOW)).toBe(NOW + 30_000);
    expect(openUntil(s, 'zai', NOW + 60_000)).toBe(0);
  });

  it('prune descarta entrada velha e mantém a que ainda esfria', () => {
    const s = { ...recordFailure({}, 'old', 'transient', NOW - 48 * 3_600_000), ...recordFailure({}, 'live', 'quota_exhausted', NOW) };
    const p = prune(s, NOW);
    expect(Object.keys(p)).toEqual(['live']);
  });
});
