// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLongPress } from './useLongPress';

const evt = () => ({ preventDefault: vi.fn() });

describe('useLongPress', () => {
  it('blocks the native context menu while a touch press is in progress', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLongPress(() => {}));
    act(() => { result.current.handlers.onTouchStart(); });
    const during = evt();
    result.current.handlers.onContextMenu(during);
    expect(during.preventDefault).toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(450); });
    const after = evt();
    result.current.handlers.onContextMenu(after);
    expect(after.preventDefault).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('leaves the desktop right-click alone', () => {
    const { result } = renderHook(() => useLongPress(() => {}));
    const e = evt();
    result.current.handlers.onContextMenu(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('leaves a long press inside a text field to the phone (select/paste)', () => {
    vi.useFakeTimers();
    const onLong = vi.fn();
    const { result } = renderHook(() => useLongPress(onLong));
    const ta = document.createElement('textarea');
    act(() => { result.current.handlers.onTouchStart({ target: ta }); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLong).not.toHaveBeenCalled();
    expect(result.current.open).toBe(false);
    const e = evt();
    result.current.handlers.onContextMenu(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
