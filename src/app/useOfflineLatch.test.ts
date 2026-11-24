// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineLatch } from './useOfflineLatch';
import { markAgentRestarting, clearAgentRestarting } from './restartNotice';
import type { ConnState } from '../components/primitives';

beforeEach(() => { vi.useFakeTimers(); clearAgentRestarting(); });
afterEach(() => { vi.useRealTimers(); });

function setup() {
  return renderHook(({ c }: { c: ConnState }) => useOfflineLatch(c), { initialProps: { c: 'connected' as ConnState } });
}

describe('useOfflineLatch', () => {
  it('shows the red banner after 6s offline when nothing was announced', () => {
    const { result, rerender } = setup();
    rerender({ c: 'down' });
    act(() => { vi.advanceTimersByTime(5900); });
    expect(result.current).toMatchObject({ showOffline: false, restarting: false });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.showOffline).toBe(true);
  });

  it('shows the restarting notice for 45s, then falls back to the red banner', () => {
    const { result, rerender } = setup();
    markAgentRestarting();
    rerender({ c: 'down' });
    expect(result.current).toMatchObject({ showOffline: false, restarting: true });
    act(() => { vi.advanceTimersByTime(44_000); });
    expect(result.current).toMatchObject({ showOffline: false, restarting: true });
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current).toMatchObject({ showOffline: true, restarting: false });
  });

  it('ignores an announcement older than 60s', () => {
    markAgentRestarting(Date.now() - 61_000);
    const { result, rerender } = setup();
    rerender({ c: 'down' });
    expect(result.current.restarting).toBe(false);
  });

  it('clears the notice on reconnect', () => {
    const { result, rerender } = setup();
    markAgentRestarting();
    rerender({ c: 'down' });
    rerender({ c: 'connected' });
    expect(result.current).toMatchObject({ showOffline: false, restarting: false });
  });
});
