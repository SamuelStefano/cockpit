// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCopied } from './useCopied';

describe('useCopied', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('marca copied=true após escrever e volta a false depois do resetMs', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { result } = renderHook(() => useCopied(1000));

    expect(result.current[0]).toBe(false);
    await act(async () => { result.current[1]('hello'); });
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result.current[0]).toBe(true);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current[0]).toBe(false);
  });

  it('cai no fallback execCommand quando o clipboard rejeita', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const exec = vi.fn(() => true);
    document.execCommand = exec;
    const { result } = renderHook(() => useCopied());
    await act(async () => { result.current[1]('x'); });
    expect(exec).toHaveBeenCalledWith('copy');
    expect(result.current[0]).toBe(true);
  });

  it('sem clipboard API usa execCommand direto', async () => {
    vi.stubGlobal('navigator', {});
    const exec = vi.fn(() => true);
    document.execCommand = exec;
    const { result } = renderHook(() => useCopied());
    await act(async () => { result.current[1]('y'); });
    expect(exec).toHaveBeenCalledWith('copy');
    expect(result.current[0]).toBe(true);
  });

  it('não marca copied quando clipboard rejeita e execCommand falha', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    document.execCommand = vi.fn(() => false);
    const { result } = renderHook(() => useCopied());
    await act(async () => { result.current[1]('x'); });
    expect(result.current[0]).toBe(false);
  });
});
