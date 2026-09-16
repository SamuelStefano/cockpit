// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUsagePanel, OPEN_REFRESH_MS } from './useUsagePanel';

describe('useUsagePanel', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('opening the panel forces a fresh read, then keeps asking while open', () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useUsagePanel(refresh));
    expect(refresh).not.toHaveBeenCalled();

    act(() => result.current.setOpen(true));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenLastCalledWith(true);

    act(() => { vi.advanceTimersByTime(OPEN_REFRESH_MS); });
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenLastCalledWith();
  });

  it('stops asking once closed', () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useUsagePanel(refresh));
    act(() => result.current.setOpen(true));
    act(() => result.current.setOpen(false));
    act(() => { vi.advanceTimersByTime(OPEN_REFRESH_MS * 3); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('coming back to the foreground with the panel open forces a read', () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useUsagePanel(refresh));
    act(() => result.current.setOpen(true));
    refresh.mockClear();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(refresh).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(refresh).toHaveBeenCalledWith(true);
  });
});
