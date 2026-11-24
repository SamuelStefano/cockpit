// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useRotatingPhrase } from './useRotatingPhrase';

afterEach(() => { vi.useRealTimers(); });

describe('useRotatingPhrase', () => {
  it('rotates every 4s while active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { result } = renderHook(() => useRotatingPhrase(true, 10_000));
    expect(result.current).toBe('Pensando…');
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(result.current).toBe('Ponderando…');
    act(() => { vi.advanceTimersByTime(4_000); });
    expect(result.current).toBe('Juntando as peças…');
  });

  it('resumes from the turn start instead of restarting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(20_000);
    const { result } = renderHook(() => useRotatingPhrase(true, 20_000 - 12_200));
    expect(result.current).toBe('Avançando…');
  });
});
