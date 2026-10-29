// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTurnTally, useTurnTallyView } from './useTurnTally';
import { emitTurnDone } from './turn-done-bus';

const confetti = vi.hoisted(() => vi.fn());
vi.mock('../../components/primitives/confetti-bus', () => ({ fireConfetti: confetti }));

beforeEach(() => { localStorage.clear(); confetti.mockClear(); });

describe('useTurnTally', () => {
  it('records a finished turn and cheers with a small burst', () => {
    const { result } = renderHook(() => { useTurnTally(); return useTurnTallyView(); });
    act(() => emitTurnDone());
    expect(result.current).toMatchObject({ streak: 1, turns: 1 });
    expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ count: 24 }));
  });

  it('bursts bigger on the 10th turn of the day', () => {
    const { result } = renderHook(() => { useTurnTally(); return useTurnTallyView(); });
    for (let i = 0; i < 10; i++) act(() => emitTurnDone());
    expect(result.current.turns).toBe(10);
    expect(confetti).toHaveBeenLastCalledWith(expect.objectContaining({ count: 90 }));
  });
});
