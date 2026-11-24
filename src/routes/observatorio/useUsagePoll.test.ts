// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUsagePoll } from './useUsagePoll';

afterEach(() => vi.useRealTimers());

describe('useUsagePoll', () => {
  it('re-requests while connected and stops when disconnected', () => {
    vi.useFakeTimers();
    const request = vi.fn();
    const { rerender } = renderHook(({ c }) => useUsagePoll(c, request, 1000), { initialProps: { c: true } });
    vi.advanceTimersByTime(2000);
    expect(request).toHaveBeenCalledTimes(2);
    rerender({ c: false });
    vi.advanceTimersByTime(3000);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('skips while the tab is hidden', () => {
    vi.useFakeTimers();
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const request = vi.fn();
    renderHook(() => useUsagePoll(true, request, 1000));
    vi.advanceTimersByTime(3000);
    expect(request).not.toHaveBeenCalled();
    vis.mockRestore();
  });
});
