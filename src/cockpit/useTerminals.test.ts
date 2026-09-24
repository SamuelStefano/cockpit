// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerminals } from './useTerminals';

describe('useTerminals exited set', () => {
  it('marks a terminal exited on term-exit and alive again when reopened', () => {
    const { result } = renderHook(() => useTerminals(vi.fn()));
    act(() => { result.current.term.attach('t1', 80, 24, vi.fn(), vi.fn(), vi.fn()); });
    act(() => { result.current.onTermExit('t1'); });
    expect(result.current.term.exited.has('t1')).toBe(true);
    act(() => { result.current.term.attach('t1', 80, 24, vi.fn(), vi.fn(), vi.fn()); });
    expect(result.current.term.exited.has('t1')).toBe(false);
  });
});

describe('useTerminals open queue and resizes', () => {
  afterEach(() => vi.useRealTimers());
  const opens = (send: ReturnType<typeof vi.fn>) => send.mock.calls.map((c) => c[0]).filter((m) => m.t === 'term-open');
  const resizes = (send: ReturnType<typeof vi.fn>) => send.mock.calls.map((c) => c[0]).filter((m) => m.t === 'term-resize');

  it('a window still queued opens at its fitted size, not 80x24', () => {
    vi.useFakeTimers();
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useTerminals(send));
    act(() => {
      result.current.term.attach('a', 80, 24, vi.fn(), vi.fn(), vi.fn());
      result.current.term.attach('b', 80, 24, vi.fn(), vi.fn(), vi.fn());
      result.current.term.resize('b', 132, 40);
    });
    act(() => { vi.advanceTimersByTime(500); });
    expect(opens(send)).toEqual([
      { t: 'term-open', termId: 'a', cols: 80, rows: 24 },
      { t: 'term-open', termId: 'b', cols: 132, rows: 40 },
    ]);
    expect(resizes(send)).toEqual([]);
  });

  it('sends a resize only when the size changes', () => {
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useTerminals(send));
    act(() => { result.current.term.attach('a', 80, 24, vi.fn(), vi.fn(), vi.fn()); });
    act(() => {
      for (let i = 0; i < 10; i++) result.current.term.resize('a', 80, 24);
      for (let i = 0; i < 10; i++) result.current.term.resize('a', 100, 30);
    });
    expect(resizes(send)).toEqual([{ t: 'term-resize', termId: 'a', cols: 100, rows: 30 }]);
  });

  it('reattach reopens each live window once, at its current size', () => {
    vi.useFakeTimers();
    const send = vi.fn(() => true);
    const { result } = renderHook(() => useTerminals(send));
    act(() => { result.current.term.attach('a', 80, 24, vi.fn(), vi.fn(), vi.fn()); });
    act(() => { result.current.term.resize('a', 90, 30); });
    send.mockClear();
    act(() => { result.current.reattach(); result.current.reattach(); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(opens(send)).toEqual([{ t: 'term-open', termId: 'a', cols: 90, rows: 30 }]);
  });
});
