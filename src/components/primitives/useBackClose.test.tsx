// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useBackClose } from './useBackClose';

afterEach(() => { cleanup(); });

describe('useBackClose', () => {
  it('pushes one entry while open and closes when the entry is popped', () => {
    const before = history.length;
    const onClose = vi.fn();
    renderHook(() => useBackClose(true, onClose));
    expect(history.length).toBe(before + 1);
    history.replaceState(null, '');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not push while closed', () => {
    const before = history.length;
    renderHook(() => useBackClose(false, () => {}));
    expect(history.length).toBe(before);
  });

  it('ignores popstate events that keep its own entry on top', () => {
    const onClose = vi.fn();
    renderHook(() => useBackClose(true, onClose));
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
