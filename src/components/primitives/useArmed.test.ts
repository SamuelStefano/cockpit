// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArmed } from './useArmed';

afterEach(() => vi.useRealTimers());

describe('useArmed', () => {
  it('runs the action only on the second tap', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useArmed());
    act(() => result.current.fire(action));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.armed).toBe(true);
    act(() => result.current.fire(action));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.armed).toBe(false);
  });

  it('disarms after the timeout', () => {
    vi.useFakeTimers();
    const action = vi.fn();
    const { result } = renderHook(() => useArmed(3000));
    act(() => result.current.fire(action));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.armed).toBe(false);
    act(() => result.current.fire(action));
    expect(action).not.toHaveBeenCalled();
  });
});
