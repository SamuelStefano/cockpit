// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { fmtElapsed, useElapsed } from './elapsed';

describe('fmtElapsed', () => {
  it('segundos abaixo de 1min, minuto+segundo acima', () => {
    expect(fmtElapsed(0)).toBe('0s');
    expect(fmtElapsed(59)).toBe('59s');
    expect(fmtElapsed(60)).toBe('1m 0s');
    expect(fmtElapsed(72)).toBe('1m 12s');
  });
});

describe('useElapsed', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sem início começa do zero', () => {
    const { result } = renderHook(() => useElapsed());
    expect(result.current).toBe(0);
  });

  it('início no passado já mostra o decorrido, sem esperar o primeiro tique', () => {
    const { result } = renderHook(() => useElapsed(Date.now() - 90_000));
    expect(result.current).toBe(90);
  });

  it('conta os segundos enquanto roda', () => {
    const t0 = Date.now();
    const { result } = renderHook(() => useElapsed(t0));
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(3);
  });

  it('desmontar para o relógio', () => {
    const t0 = Date.now();
    const { unmount } = renderHook(() => useElapsed(t0));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
