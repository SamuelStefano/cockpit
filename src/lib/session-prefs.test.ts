import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const update = vi.fn();
const eq = vi.fn();
vi.mock('./supabase', () => ({
  SUPABASE_ENABLED: true,
  supabase: { from: () => ({ update: (row: unknown) => { update(row); return { eq }; } }) },
}));

import { resolvePref, syncEnabled, pushPinsRemote, pushTagsRemote } from './session-prefs';

describe('remote push', () => {
  beforeEach(() => { vi.useFakeTimers(); update.mockClear(); eq.mockReset(); eq.mockResolvedValue({ error: null }); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('writes [] (not null) when the last favorite is removed', () => {
    pushPinsRemote('u1', []);
    vi.advanceTimersByTime(500);
    expect(update).toHaveBeenCalledWith({ pinned_sessions: [] });
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('writes {} (not null) when the last tag is removed', () => {
    pushTagsRemote('u1', {});
    vi.advanceTimersByTime(500);
    expect(update).toHaveBeenCalledWith({ session_tags: {} });
  });

  it('debounces to the latest pins', () => {
    pushPinsRemote('u1', ['a']);
    pushPinsRemote('u1', ['a', 'b']);
    vi.advanceTimersByTime(500);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ pinned_sessions: ['a', 'b'] });
  });

  it('warns instead of failing silently when the update is rejected', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    eq.mockResolvedValue({ error: { message: 'boom' } });
    pushPinsRemote('u1', ['a']);
    vi.advanceTimersByTime(500);
    await Promise.resolve();
    expect(warn).toHaveBeenCalledWith('[session-prefs] pinned_sessions push failed:', 'boom');
  });
});

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
