// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCockpit } from './useCockpit';
import type { ServerMsg } from '../shared/protocol';

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readonly OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  sent: string[] = [];
  constructor(public url: string) { FakeWebSocket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = FakeWebSocket.CLOSED; }
}

const SID = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('session-touched on the open session', () => {
  it('re-fetches the history at most once per window, plus a trailing one', () => {
    const hook = renderHook(() => useCockpit());
    const ws = FakeWebSocket.instances.at(-1)!;
    act(() => { ws.onopen?.({}); });
    act(() => { hook.result.current.setActiveId(SID); });
    vi.useFakeTimers();
    const opens = () => ws.sent.map((d) => JSON.parse(d)).filter((m) => (m.t === 'open' || m.t === 'open-full') && m.sessionId === SID).length;
    const before = opens();
    const touch: ServerMsg = { t: 'session-touched', sessionId: SID } as ServerMsg;
    for (let i = 0; i < 10; i++) {
      act(() => { ws.onmessage?.({ data: JSON.stringify(touch) }); });
      act(() => { vi.advanceTimersByTime(300); });
    }
    expect(opens() - before).toBe(1);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(opens() - before).toBe(2);
  });
});
