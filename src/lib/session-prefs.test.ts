import { describe, it, expect } from 'vitest';
import { resolvePref, syncEnabled } from './session-prefs';

describe('resolvePref', () => {
  it('remoto presente vence o local (deleção em outro device propaga)', () => {
    expect(resolvePref(['a'], ['a', 'b'], true)).toEqual({ value: ['a'], seed: false });
  });

  it('remoto vazio (mas presente) também vence — desfavoritar tudo propaga', () => {
    expect(resolvePref([], ['a'], true)).toEqual({ value: [], seed: false });
  });

  it('remoto nulo com local: mantém local e marca seed', () => {
    expect(resolvePref(null, ['a'], true)).toEqual({ value: ['a'], seed: true });
  });

  it('remoto nulo sem local: nada a semear', () => {
    expect(resolvePref(null, [], false)).toEqual({ value: [], seed: false });
  });
});

describe('syncEnabled', () => {
  it('exige Supabase ligado E userId', () => {
    // No ambiente de teste SUPABASE_ENABLED é false → sempre false, mesmo com id.
    expect(syncEnabled(undefined)).toBe(false);
  });
});
