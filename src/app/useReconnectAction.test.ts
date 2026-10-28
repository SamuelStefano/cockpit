// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { RECONNECT_RESULT_MS, useReconnectAction } from './useReconnectAction';
import type { ConnState } from '../components/primitives';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useReconnectAction', () => {
  it('forces a fresh dial and shows "trying", then "failed" if nothing connects', () => {
    const reconnectNow = vi.fn();
    const { result } = renderHook(() => useReconnectAction(reconnectNow, 'down'));
    act(() => { result.current.trigger(); });
    expect(reconnectNow).toHaveBeenCalledWith({ force: true });
    expect(result.current.status).toBe('trying');
    act(() => { vi.advanceTimersByTime(RECONNECT_RESULT_MS); });
    expect(result.current.status).toBe('failed');
  });

  it('goes back to idle once the socket connects', () => {
    const reconnectNow = vi.fn();
    const { result, rerender } = renderHook(({ c }: { c: ConnState }) => useReconnectAction(reconnectNow, c), { initialProps: { c: 'down' as ConnState } });
    act(() => { result.current.trigger(); });
    rerender({ c: 'connected' });
    expect(result.current.status).toBe('idle');
    act(() => { vi.advanceTimersByTime(RECONNECT_RESULT_MS); });
    expect(result.current.status).toBe('idle');
  });
});
