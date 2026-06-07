// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionsPanel } from './useSessionsPanel';

const base = { sessions: [], searchResults: [] };

describe('useSessionsPanel', () => {
  beforeEach(() => { localStorage.clear(); vi.useRealTimers(); });
  afterEach(() => vi.useRealTimers());

  it('togglePin fixa e desfixa', () => {
    const { result } = renderHook(() => useSessionsPanel(base));
    act(() => result.current.togglePin('a'));
    expect(result.current.pinned.has('a')).toBe(true);
    act(() => result.current.togglePin('a'));
    expect(result.current.pinned.has('a')).toBe(false);
  });

  it('addTag não duplica e removeTag limpa a entrada quando esvazia', () => {
    const { result } = renderHook(() => useSessionsPanel(base));
    act(() => result.current.addTag('s1', 'urgente'));
    act(() => result.current.addTag('s1', 'urgente')); // dup ignorada
    expect(result.current.tagMap.s1).toEqual(['urgente']);
    act(() => result.current.removeTag('s1', 'urgente'));
    expect(result.current.tagMap.s1).toBeUndefined();
  });

  it('allTags é a união ordenada de todas as tags', () => {
    const { result } = renderHook(() => useSessionsPanel(base));
    act(() => result.current.addTag('s1', 'zeta'));
    act(() => result.current.addTag('s2', 'alfa'));
    act(() => result.current.addTag('s2', 'zeta')); // união sem repetir
    expect(result.current.allTags).toEqual(['alfa', 'zeta']);
  });

  it('onSearch dispara com debounce de 150ms após o query mudar', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const { result } = renderHook(() => useSessionsPanel({ ...base, onSearch }));
    onSearch.mockClear(); // ignora o disparo inicial (query='')
    act(() => result.current.setQuery('foo'));
    expect(onSearch).not.toHaveBeenCalled(); // ainda dentro do debounce
    act(() => vi.advanceTimersByTime(150));
    expect(onSearch).toHaveBeenCalledWith('foo');
  });
});
