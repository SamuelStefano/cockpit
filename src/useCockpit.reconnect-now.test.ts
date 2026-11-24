// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCockpit } from './useCockpit';
import { recentConnEvents, resetTelemetryForTests } from './app/connectionTelemetry';

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readonly OPEN = 1;
  readyState = 0;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(public url: string) { FakeWebSocket.instances.push(this); }
  send() {}
  close() { this.readyState = 3; }
}

beforeEach(() => { vi.useFakeTimers(); FakeWebSocket.instances = []; vi.stubGlobal('WebSocket', FakeWebSocket); localStorage.clear(); resetTelemetryForTests(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('reconnectNow({ force: true }) — the "Reconectar agora" button', () => {
  it('dials a new socket at once, even deep in the backoff, and drops the pending retry', () => {
    const hook = renderHook(() => useCockpit());
    // Several failed dials push the backoff up.
    for (let i = 0; i < 4; i++) {
      const ws = FakeWebSocket.instances.at(-1)!;
      act(() => { ws.readyState = 3; ws.onclose?.({ code: 1006, reason: '' }); });
      act(() => { vi.advanceTimersByTime(30_000); });
    }
    const before = FakeWebSocket.instances.length;
    act(() => { FakeWebSocket.instances.at(-1)!.onclose?.({ code: 1006, reason: '' }); });
    act(() => { hook.result.current.reconnectNow({ force: true }); });
    expect(FakeWebSocket.instances.length).toBe(before + 1);
    expect(hook.result.current.conn.ws).toBe('reconnecting');
    // The retry that was pending must not dial a second socket on top.
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(FakeWebSocket.instances.length).toBe(before + 1);
    expect(recentConnEvents().some((e) => e.ev === 'manual_reconnect')).toBe(true);
    hook.unmount();
  });

  it('replaces a socket that still says OPEN but went silent', () => {
    const hook = renderHook(() => useCockpit());
    const ws = FakeWebSocket.instances.at(-1)!;
    act(() => { ws.readyState = 1; ws.onopen?.({}); });
    const before = FakeWebSocket.instances.length;
    act(() => { hook.result.current.reconnectNow({ force: true }); });
    expect(FakeWebSocket.instances.length).toBe(before + 1);
    hook.unmount();
  });

  it('without force, a live socket is only reconciled', () => {
    const hook = renderHook(() => useCockpit());
    const ws = FakeWebSocket.instances.at(-1)!;
    act(() => { ws.readyState = 1; ws.onopen?.({}); });
    const before = FakeWebSocket.instances.length;
    act(() => { hook.result.current.reconnectNow(); });
    expect(FakeWebSocket.instances.length).toBe(before);
    hook.unmount();
  });
});
