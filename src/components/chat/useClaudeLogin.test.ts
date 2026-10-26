// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClaudeLogin } from './useClaudeLogin';
import type { ClaudeLoginView } from '../../../shared/protocol';

describe('useClaudeLogin', () => {
  it('start fires onStart and is busy while waiting for the url', () => {
    const onStart = vi.fn();
    const { result, rerender } = renderHook((p: { login: ClaudeLoginView }) => useClaudeLogin({ ...p, onStart }), { initialProps: { login: { state: 'idle' } } });
    expect(result.current.busy).toBe(false);
    act(() => result.current.start());
    expect(onStart).toHaveBeenCalledTimes(1);
    rerender({ login: { state: 'waiting-url' } });
    expect(result.current.busy).toBe(true);
  });

  it('submits a trimmed code only once the url is shown, then clears the field', () => {
    const onCode = vi.fn();
    const { result, rerender } = renderHook((p: { login: ClaudeLoginView }) => useClaudeLogin({ ...p, onCode }), { initialProps: { login: { state: 'waiting-url', url: undefined } as ClaudeLoginView } });
    act(() => result.current.setCode(' abc '));
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.submit());
    expect(onCode).not.toHaveBeenCalled();
    rerender({ login: { state: 'url', url: 'https://claude.com/x/oauth/authorize' } });
    expect(result.current.canSubmit).toBe(true);
    act(() => result.current.submit());
    expect(onCode).toHaveBeenCalledWith('abc');
    expect(result.current.code).toBe('');
  });

  it('verifying is busy; error exposes the message and reset cancels', () => {
    const onCancel = vi.fn();
    const { result, rerender } = renderHook((p: { login: ClaudeLoginView }) => useClaudeLogin({ ...p, onCancel }), { initialProps: { login: { state: 'verifying' } as ClaudeLoginView } });
    expect(result.current.busy).toBe(true);
    rerender({ login: { state: 'error', error: 'Invalid code' } });
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBe('Invalid code');
    act(() => result.current.reset());
    expect(onCancel).toHaveBeenCalled();
  });
});
