// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNotasEditor } from './useNotasEditor';

const noop = () => {};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useNotasEditor', () => {
  it('não diz "salvo" quando o frame não saiu', () => {
    const save = vi.fn(() => false);
    const { result } = renderHook(() => useNotasEditor('', true, noop, save, false));
    act(() => { result.current.onChange('rascunho'); });
    expect(result.current.status).toBe('saving');
    act(() => { vi.advanceTimersByTime(700); });
    expect(result.current.status).toBe('offline');
  });

  it('marca salvo quando o frame saiu', () => {
    const save = vi.fn(() => true);
    const { result } = renderHook(() => useNotasEditor('', true, noop, save, true));
    act(() => { result.current.onChange('rascunho'); });
    act(() => { vi.advanceTimersByTime(700); });
    expect(result.current.status).toBe('saved');
    expect(save).toHaveBeenCalledWith('rascunho');
  });

  it('reenvia sozinho quando a conexão volta', () => {
    const save = vi.fn(() => false);
    const { result, rerender } = renderHook(
      ({ conn }: { conn: boolean }) => useNotasEditor('', true, noop, save, conn),
      { initialProps: { conn: false } },
    );
    act(() => { result.current.onChange('rascunho'); });
    act(() => { vi.advanceTimersByTime(700); });
    expect(result.current.status).toBe('offline');
    save.mockReturnValue(true);
    rerender({ conn: true });
    expect(result.current.status).toBe('saved');
    expect(save).toHaveBeenLastCalledWith('rascunho');
  });

  it('does not push a fragment typed before the first load over the whole note', () => {
    const save = vi.fn(() => false);
    const { result, rerender } = renderHook(
      ({ conn, loaded }: { conn: boolean; loaded: boolean }) => useNotasEditor('', loaded, noop, save, conn),
      { initialProps: { conn: false, loaded: false } },
    );
    act(() => { result.current.onChange('fragmento'); });
    act(() => { vi.advanceTimersByTime(700); });
    save.mockClear();
    save.mockReturnValue(true);
    rerender({ conn: true, loaded: false });
    expect(save).not.toHaveBeenCalled();
  });
});
