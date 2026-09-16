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
});
