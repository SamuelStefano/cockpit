// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadStalled } from './useLoadStalled';

describe('useLoadStalled', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fica stalled após o timeout sem loaded', () => {
    const { result } = renderHook(() => useLoadStalled(false, true, 1000));
    expect(result.current.stalled).toBe(false);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.stalled).toBe(true);
  });

  it('não dispara quando loaded chega antes', () => {
    const { result, rerender } = renderHook(({ loaded }) => useLoadStalled(loaded, true, 1000), {
      initialProps: { loaded: false },
    });
    act(() => vi.advanceTimersByTime(500));
    rerender({ loaded: true });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.stalled).toBe(false);
  });

  it('não dispara quando inativo (desconectado)', () => {
    const { result } = renderHook(() => useLoadStalled(false, false, 1000));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.stalled).toBe(false);
  });

  it('retry limpa o stalled e rearma o timer', () => {
    const { result } = renderHook(() => useLoadStalled(false, true, 1000));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.stalled).toBe(true);
    act(() => result.current.retry());
    expect(result.current.stalled).toBe(false);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.stalled).toBe(true);
  });

  it('loaded depois de stalled limpa o estado', () => {
    const { result, rerender } = renderHook(({ loaded }) => useLoadStalled(loaded, true, 1000), {
      initialProps: { loaded: false },
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.stalled).toBe(true);
    rerender({ loaded: true });
    expect(result.current.stalled).toBe(false);
  });
});
