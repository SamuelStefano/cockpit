// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePairingEject } from './usePairingEject';

describe('usePairingEject', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('não ejeta enquanto o WS ainda não conectou (evita flash no boot)', () => {
    const { result } = renderHook(() => usePairingEject(false, 'u1', false));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(false);
  });

  it('não ejeta se o agent fica online logo após o connect (refresh já pareado)', () => {
    const { result, rerender } = renderHook(
      ({ on, conn }) => usePairingEject(on, 'u1', conn),
      { initialProps: { on: false, conn: true } },
    );
    expect(result.current).toBe(false);
    act(() => { rerender({ on: true, conn: true }); });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current).toBe(false);
  });

  it('ejeta após a carência de boot quando conectado e agent ausente', () => {
    const { result } = renderHook(() => usePairingEject(false, 'u1', true));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toBe(true);
  });

  it('segura ~8s para atravessar o flap depois de já ter estado online', () => {
    const { result, rerender } = renderHook(
      ({ on }) => usePairingEject(on, 'u1', true),
      { initialProps: { on: true } },
    );
    act(() => { rerender({ on: false }); });
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current).toBe(true);
  });

  it('troca de conta zera o latch e volta pro pareamento', () => {
    const { result, rerender } = renderHook(
      ({ uid }) => usePairingEject(true, uid, true),
      { initialProps: { uid: 'u1' as string | undefined } },
    );
    expect(result.current).toBe(false);
    act(() => { rerender({ uid: 'u2' }); });
    expect(result.current).toBe(true);
  });
});
