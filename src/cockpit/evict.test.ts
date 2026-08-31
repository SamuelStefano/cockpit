import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { selectEvictions, pruneRefs } from './evict';

const base = { active: 'x', cap: 3, running: new Set<string>(), inFlight: new Set<string>(), lastActivity: {} as Record<string, number> };

describe('selectEvictions', () => {
  it('returns nothing when at or below the cap', () => {
    expect(selectEvictions(['a', 'b', 'c'], { ...base, cap: 3 })).toEqual([]);
  });

  it('evicts the oldest by activity down to the cap', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const lastActivity = { a: 40, b: 10, c: 30, d: 20 };
    expect(selectEvictions(keys, { ...base, active: 'a', cap: 2, lastActivity })).toEqual(['b', 'd']);
  });

  it('never evicts the active, running, in-flight, or new- threads', () => {
    const keys = ['active', 'run', 'flight', 'new-z', 'old'];
    const opts = {
      ...base,
      active: 'active',
      cap: 1,
      running: new Set(['run']),
      inFlight: new Set(['flight']),
      lastActivity: { old: 1, active: 2, run: 3, flight: 4, 'new-z': 5 },
    };
    expect(selectEvictions(keys, opts)).toEqual(['old']);
  });

  it('treats missing activity as oldest', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const lastActivity = { a: 100, b: 50, c: 80 };
    expect(selectEvictions(keys, { ...base, active: 'a', cap: 2, lastActivity })).toEqual(['d', 'b']);
  });
});

describe('pruneRefs', () => {
  it('apaga a chave em todos os mapas e não toca nas outras', () => {
    const a: Record<string, number> = { x: 1, y: 2 };
    const b: Record<string, string> = { x: 'a', z: 'c' };
    pruneRefs([a, b], ['x']);
    expect(a).toEqual({ y: 2 });
    expect(b).toEqual({ z: 'c' });
  });

  it('chave ausente num dos mapas não quebra a poda dos outros', () => {
    const a: Record<string, number> = {};
    const b: Record<string, number> = { x: 1 };
    pruneRefs([a, b], ['x']);
    expect(b).toEqual({});
  });
});

// O `usage` (state) já era podado no despejo e o `usageRef` (espelho síncrono) não:
// reabrir uma sessão despejada semeava turnBaseRef com o contexto VELHO e o ticker
// de tokens do turno nascia errado — fora de crescer sem teto numa aba de dias.
// A guarda é estática porque o despejo vive dentro do useCockpit (sem seam de teste):
// se um mapa por-sessão sumir da chamada, isto vermelha.
describe('despejo no useCockpit', () => {
  const fonte = readFileSync(new URL('../useCockpit.ts', import.meta.url), 'utf8');
  const chamada = fonte.slice(fonte.indexOf('pruneRefs(['), fonte.indexOf('], drop);'));

  it.each(['lastActivity', 'resumeId', 'runMsg', 'runStartRef', 'usageRef', 'turnBaseRef', 'liveCharsRef', 'liveRealRef', 'serverKey', 'viewMode'])(
    'poda %s junto com o thread',
    (mapa) => { expect(chamada).toContain(`${mapa}.current`); },
  );

  it('não sobrou delete solto por chave despejada', () => {
    expect(fonte).not.toMatch(/for \(const k of drop\) \{/);
  });
});
