// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUsageRetry, USAGE_RETRY_MS, USAGE_RETRY_MAX } from './useUsageRetry';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useUsageRetry', () => {
  it('repete o pedido enquanto sem dados, até o teto', () => {
    const request = vi.fn();
    renderHook(() => useUsageRetry(true, false, request));
    for (let i = 0; i < USAGE_RETRY_MAX + 2; i++) {
      act(() => { vi.advanceTimersByTime(USAGE_RETRY_MS); });
    }
    expect(request).toHaveBeenCalledTimes(USAGE_RETRY_MAX);
  });

  it('não pede quando já tem dados', () => {
    const request = vi.fn();
    renderHook(() => useUsageRetry(true, true, request));
    act(() => { vi.advanceTimersByTime(USAGE_RETRY_MS * 3); });
    expect(request).not.toHaveBeenCalled();
  });

  it('não pede quando desconectado', () => {
    const request = vi.fn();
    renderHook(() => useUsageRetry(false, false, request));
    act(() => { vi.advanceTimersByTime(USAGE_RETRY_MS * 3); });
    expect(request).not.toHaveBeenCalled();
  });
});
