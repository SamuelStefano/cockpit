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

  it('engole a rejeição do clipboard sem marcar copied', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { result } = renderHook(() => useCopied());
    await act(async () => { result.current[1]('x'); });
    expect(result.current[0]).toBe(false);
  });
});
