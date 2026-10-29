// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionsPanel } from './useSessionsPanel';
import type { Session } from '../../data/types';

const base = { sessions: [], searchResults: [] };

const sess = (id: string): Session =>
  ({ id, title: id, relative: 'agora', snippet: '', mtime: Date.now(), hasTerminal: false, active: false });

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

  it('fecha o confirm de arquivar se a sessão sumir (deletada/arquivada remotamente)', () => {
    const { result, rerender } = renderHook(
      ({ sessions }) => useSessionsPanel({ ...base, sessions }),
      { initialProps: { sessions: [sess('a')] } },
    );
    act(() => result.current.setConfirmId('a'));
    expect(result.current.confirmId).toBe('a');
    rerender({ sessions: [] });
    expect(result.current.confirmId).toBeNull();
  });

  it('confirm de excluir vale para sessão arquivada e fecha quando ela some de ambas as listas', () => {
    const { result, rerender } = renderHook(
      ({ archived }) => useSessionsPanel({ ...base, sessions: [], archived }),
      { initialProps: { archived: [sess('b')] } },
    );
    act(() => result.current.setDeleteId('b'));
    expect(result.current.deleteId).toBe('b');
    rerender({ archived: [] });
    expect(result.current.deleteId).toBeNull();
  });

  it('onSearch dispara com debounce de 350ms após o query mudar', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const { result } = renderHook(() => useSessionsPanel({ ...base, onSearch }));
    onSearch.mockClear(); // ignora o disparo inicial (query='')
    act(() => result.current.setQuery('foo'));
    expect(onSearch).not.toHaveBeenCalled(); // ainda dentro do debounce
    act(() => vi.advanceTimersByTime(350));
    expect(onSearch).toHaveBeenCalledWith('foo');
  });
});
