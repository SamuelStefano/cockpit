// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOAD_DEBOUNCE_MS, LOAD_TIMEOUT_MS, REFRESH_MS, shouldLoad, useThreadLoader } from './useThreadLoader';

describe('shouldLoad', () => {
  const thread = [1];
  it('waits while the last request is unanswered, then lets a new thread or 30s through', () => {
    expect(shouldLoad(null, undefined, 0)).toBe(true);
    expect(shouldLoad({ sentAt: 0, thread }, thread, 1000)).toBe(false);
    expect(shouldLoad({ sentAt: 0, thread }, [1], 1000)).toBe(true);
    expect(shouldLoad({ sentAt: 0, thread }, thread, LOAD_TIMEOUT_MS)).toBe(true);
  });
});

describe('useThreadLoader', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  it('debounces the first load and skips ticks while it is unanswered', () => {
    const load = vi.fn();
    renderHook(() => useThreadLoader('s1', undefined, true, true, load));
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LOAD_DEBOUNCE_MS);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(REFRESH_MS * 2);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(LOAD_TIMEOUT_MS);
    expect(load.mock.calls.length).toBeGreaterThan(1);
  });
  it('asks again once the thread object changes', () => {
    const load = vi.fn();
    let thread: unknown = undefined;
    const { rerender } = renderHook(() => useThreadLoader('s1', thread, true, true, load));
    vi.advanceTimersByTime(LOAD_DEBOUNCE_MS);
    thread = [1];
    rerender();
    vi.advanceTimersByTime(REFRESH_MS);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
