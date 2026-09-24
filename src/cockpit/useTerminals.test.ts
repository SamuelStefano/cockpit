// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
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
