// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSendDiag } from './useSendDiag';

describe('useSendDiag', () => {
  it('sends one manual report and confirms "sent"', async () => {
    const send = vi.fn(async () => true);
    const { result } = renderHook(() => useSendDiag(send));
    await act(async () => { await result.current.trigger(); });
    expect(send).toHaveBeenCalledWith('manual', { byUser: true });
    expect(result.current.state).toBe('sent');
  });

  it('says so when the insert failed', async () => {
    const { result } = renderHook(() => useSendDiag(async () => false));
    await act(async () => { await result.current.trigger(); });
    expect(result.current.state).toBe('failed');
  });

  it('stops at the hourly cap instead of spamming the admin', async () => {
    const send = vi.fn(async () => true);
    const { result } = renderHook(() => useSendDiag(send));
    for (let i = 0; i < 12; i++) await act(async () => { await result.current.trigger(); });
    expect(result.current.state).toBe('limited');
    expect(send.mock.calls.length).toBeLessThanOrEqual(10);
  });
});
