// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInlineEdit } from './useInlineEdit';

const key = (k: string, composing = false, keyCode = 0, timeStamp = 1000) =>
  ({ key: k, keyCode, timeStamp, nativeEvent: { isComposing: composing }, preventDefault: vi.fn() }) as unknown as React.KeyboardEvent<HTMLInputElement>;

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
    act(() => { result.current.onCompositionEnd({ timeStamp: 995 } as React.CompositionEvent<HTMLInputElement>); });
    act(() => { result.current.onKeyDown(key('Enter', false, 229)); });
    act(() => { result.current.onKeyDown(key('Escape', true)); });
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(true);
    expect(result.current.draft).toBe('日');
  });

  it('commits on an Enter reported as keyCode 229 outside a composition', () => {
    const onSave = vi.fn();
    const { result } = renderHook(() => useInlineEdit({ value: 'a', onSave }));
    act(() => { result.current.start(); result.current.setDraft('b'); });
    act(() => { result.current.onKeyDown(key('Enter', false, 229)); });
    expect(onSave).toHaveBeenCalledWith('b');
  });
});
