// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInlineEdit } from './useInlineEdit';

const key = (k: string, composing = false, keyCode = 0) =>
  ({ key: k, keyCode, nativeEvent: { isComposing: composing }, preventDefault: vi.fn() }) as unknown as React.KeyboardEvent<HTMLInputElement>;

describe('useInlineEdit', () => {
  it('commits a changed value on Enter', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useInlineEdit({ value: 'a', onSave }));
    act(() => { result.current.start(); result.current.setDraft('b'); });
    act(() => { result.current.onKeyDown(key('Enter')); });
    expect(onSave).toHaveBeenCalledWith('b');
    expect(result.current.editing).toBe(false);
  });

  it('ignores Enter and Escape during IME composition', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useInlineEdit({ value: 'a', onSave }));
    act(() => { result.current.start(); result.current.setDraft('日'); });
    act(() => { result.current.onKeyDown(key('Enter', true)); });
    act(() => { result.current.onKeyDown(key('Enter', false, 229)); });
    act(() => { result.current.onKeyDown(key('Escape', true)); });
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(true);
    expect(result.current.draft).toBe('日');
  });
});
