// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePersisted, savePref } from './persist';

describe('usePersisted', () => {
  beforeEach(() => localStorage.clear());

  it('seeds initial state from the stored pref', () => {
    savePref('mode', 'plan');
    const { result } = renderHook(() => usePersisted('mode', 'execute'));
    expect(result.current[0]).toBe('plan');
  });

  it('falls back when no pref is stored', () => {
    const { result } = renderHook(() => usePersisted('mode', 'execute'));
    expect(result.current[0]).toBe('execute');
  });

  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => usePersisted('width', 200));
    act(() => result.current[1](320));
    expect(result.current[0]).toBe(320);
    expect(localStorage.getItem('cockpit:width')).toBe('320');
  });

  it('supports functional updates', () => {
    const { result } = renderHook(() => usePersisted('count', 1));
    act(() => result.current[1]((n) => n + 1));
    expect(result.current[0]).toBe(2);
  });

  it('keeps two instances of the same key in sync without reload', () => {
    const a = renderHook(() => usePersisted<string[]>('pinned', []));
    const b = renderHook(() => usePersisted<string[]>('pinned', []));
    act(() => a.result.current[1](['x']));
    expect(b.result.current[0]).toEqual(['x']);
  });

  it('does not cross-talk between different keys', () => {
    const a = renderHook(() => usePersisted('k1', 0));
    const b = renderHook(() => usePersisted('k2', 0));
    act(() => a.result.current[1](9));
    expect(b.result.current[0]).toBe(0);
  });
});
