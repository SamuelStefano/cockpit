// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJustDone } from './useJustDone';
import { DONE_HOLD_MS } from './turn-bit-state';

describe('useJustDone', () => {
  it('is true briefly after active falls', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ a }) => useJustDone(a), { initialProps: { a: true } });
    expect(result.current).toBe(false);
    rerender({ a: false });
    expect(result.current).toBe(true);
    act(() => { vi.advanceTimersByTime(DONE_HOLD_MS + 10); });
    expect(result.current).toBe(false);
    vi.useRealTimers();
  });
  it('never fires without a prior active', () => {
    const { result } = renderHook(() => useJustDone(false));
    expect(result.current).toBe(false);
  });
});
