// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAllClear, ALL_CLEAR_HOLD_MS } from './useAllClear';

afterEach(() => vi.useRealTimers());

describe('useAllClear', () => {
  it('stays false at start and on the way up', () => {
    const { result, rerender } = renderHook(({ n }) => useAllClear(n), { initialProps: { n: 0 } });
    expect(result.current).toBe(false);
    rerender({ n: 2 });
    expect(result.current).toBe(false);
  });

  it('turns true when pending falls to zero, then clears after the hold', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ n }) => useAllClear(n), { initialProps: { n: 3 } });
    rerender({ n: 0 });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(ALL_CLEAR_HOLD_MS + 1); });
    expect(result.current).toBe(false);
  });

  it('drops the cheer when new work arrives', () => {
    const { result, rerender } = renderHook(({ n }) => useAllClear(n), { initialProps: { n: 1 } });
    rerender({ n: 0 });
    rerender({ n: 1 });
    expect(result.current).toBe(false);
  });
});
