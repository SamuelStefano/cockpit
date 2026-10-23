// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNowTick } from './useNowTick';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
afterEach(() => vi.useRealTimers());

describe('useNowTick', () => {
  it('avança a cada segundo enquanto ativo', () => {
    const { result } = renderHook(() => useNowTick(true));
    expect(result.current).toBe(1_000_000);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(1_003_000);
  });

  it('parado não avança', () => {
    const { result } = renderHook(() => useNowTick(false));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(1_000_000);
  });
});
