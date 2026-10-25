// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Message } from '../../data/types';
import type { TurnPhase } from '../bit/turn-bit-state';
import { useTurnBit } from './useTurnBit';

const msgs: Message[] = [{ id: 'a', role: 'assistant', blocks: [{ type: 'text', md: 'oi' }] }];

describe('useTurnBit', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (phase: TurnPhase, failed = false) =>
    renderHook((p: { phase: TurnPhase; failed: boolean }) => useTurnBit({ phase: p.phase, messages: msgs, waiting: false, failed: p.failed }), { initialProps: { phase, failed } });

  it('starts idle with no turn, without celebrating', () => {
    expect(setup('idle').result.current).toBe('idle');
  });

  it('celebrates for two seconds after a turn ends, then idles', () => {
    const h = setup('streaming');
    expect(h.result.current).toBe('talking');
    h.rerender({ phase: 'idle', failed: false });
    expect(h.result.current).toBe('happy');
    act(() => vi.advanceTimersByTime(1999));
    expect(h.result.current).toBe('happy');
    act(() => vi.advanceTimersByTime(1));
    expect(h.result.current).toBe('idle');
  });

  it('a failed turn shows the error instead of celebrating', () => {
    const h = setup('streaming');
    h.rerender({ phase: 'idle', failed: true });
    expect(h.result.current).toBe('error');
  });

  it('a new turn cuts the celebration short', () => {
    const h = setup('streaming');
    h.rerender({ phase: 'idle', failed: false });
    h.rerender({ phase: 'thinking', failed: false });
    expect(h.result.current).toBe('thinking');
    act(() => vi.advanceTimersByTime(2500));
    expect(h.result.current).toBe('thinking');
  });
});
