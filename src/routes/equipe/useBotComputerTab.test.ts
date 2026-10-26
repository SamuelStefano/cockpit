// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBotComputerTab } from './useBotComputerTab';
import { COMPUTER_POLL_MS } from './computer-view';
import type { BotComputerApi } from './equipe-props';

afterEach(() => { vi.useRealTimers(); });

function api() {
  const onBotComputerGet = vi.fn();
  return { botComputers: {} as BotComputerApi['botComputers'], onBotComputerGet };
}

describe('useBotComputerTab', () => {
  it('polls while the bot is working and stops when idle', () => {
    vi.useFakeTimers();
    const a = api();
    const hook = renderHook(({ state }: { state: 'idle' | 'working' }) => useBotComputerTab('capo1', a, true, state), { initialProps: { state: 'working' as 'idle' | 'working' } });
    expect(a.onBotComputerGet).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(COMPUTER_POLL_MS); });
    expect(a.onBotComputerGet).toHaveBeenCalledTimes(2);
    hook.rerender({ state: 'idle' });
    act(() => { vi.advanceTimersByTime(COMPUTER_POLL_MS * 2); });
    expect(a.onBotComputerGet).toHaveBeenCalledTimes(3);
  });

  it('does not poll while taken over; Soltar refreshes', () => {
    vi.useFakeTimers();
    const a = api();
    const hook = renderHook(() => useBotComputerTab('capo1', a, true, 'working'));
    act(() => { hook.result.current.takeOver(); });
    const n = a.onBotComputerGet.mock.calls.length;
    act(() => { vi.advanceTimersByTime(COMPUTER_POLL_MS * 2); });
    expect(a.onBotComputerGet).toHaveBeenCalledTimes(n);
    act(() => { hook.result.current.release(); });
    expect(a.onBotComputerGet.mock.calls.length).toBeGreaterThanOrEqual(n + 1);
  });
});
