import { describe, it, expect } from 'vitest';
import { addThumb, shouldRequestThumb } from './att-thumb-cache';

describe('addThumb', () => {
  it('adiciona entrada nova', () => {
    const next = addThumb({}, 'a', 'xxx');
    expect(next).toEqual({ a: 'xxx' });
  });

  it('não sobrescreve entrada existente (retorna o mesmo objeto)', () => {
    const prev = { a: 'old' };
    expect(addThumb(prev, 'a', 'new')).toBe(prev);
  });

  it('evita entrada maior que o teto', () => {
    const prev = {};
    expect(addThumb(prev, 'big', 'x'.repeat(11), 10)).toBe(prev);
  });

  it('expulsa as entradas mais antigas quando passa do teto', () => {
    let cache: Record<string, string> = {};
    cache = addThumb(cache, 'a', 'x'.repeat(4), 10);
    cache = addThumb(cache, 'b', 'x'.repeat(4), 10);
    cache = addThumb(cache, 'c', 'x'.repeat(4), 10);
    expect(Object.keys(cache)).toEqual(['b', 'c']);
  });

  it('nunca expulsa a entrada recém-inserida', () => {
    let cache: Record<string, string> = {};
    cache = addThumb(cache, 'a', 'x'.repeat(4), 10);
    cache = addThumb(cache, 'b', 'x'.repeat(9), 10);
    expect(Object.keys(cache)).toEqual(['b']);
  });

  it('rejeita entrada maior que o cap por entrada (modal de pdf/vídeo grande)', () => {
    const prev = { a: 'x'.repeat(4) };
    expect(addThumb(prev, 'big', 'x'.repeat(6), 100, 5)).toBe(prev);
  });
});

describe('shouldRequestThumb', () => {
  it('pede quando não está em cache, pending nem requested', () => {
    expect(shouldRequestThumb({}, new Set(), new Set(), 'a')).toBe(true);
  });

  it('não pede quando já está em cache ou pending', () => {
    expect(shouldRequestThumb({ a: 'x' }, new Set(), new Set(), 'a')).toBe(false);
    expect(shouldRequestThumb({}, new Set(['a']), new Set(), 'a')).toBe(false);
  });

  it('path expulso do cache não re-pede (anti-livelock de eviction)', () => {
    const requested = new Set<string>();
    let cache: Record<string, string> = {};
    for (const p of ['a', 'b', 'c']) {
      expect(shouldRequestThumb(cache, new Set(), requested, p)).toBe(true);
      requested.add(p);
      cache = addThumb(cache, p, 'x'.repeat(4), 10);
    }
    expect(Object.keys(cache)).toEqual(['b', 'c']);
    expect(shouldRequestThumb(cache, new Set(), requested, 'a')).toBe(false);
  });
});
