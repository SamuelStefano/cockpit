// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCockpit } from './useCockpit';
import type { ServerMsg } from '../shared/protocol';

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readonly OPEN = 1;
  readyState = 1;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  sent: string[] = [];
  constructor(public url: string) { FakeWebSocket.instances.push(this); }
  send(d: string) { this.sent.push(d); }
  close() { this.readyState = 3; }
}

const U = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';
const V = '11111111-2222-4333-8444-555555555555';

beforeEach(() => { FakeWebSocket.instances = []; vi.stubGlobal('WebSocket', FakeWebSocket); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('reconnect', () => {
  it('a session viewed before the socket dropped is re-fetched on its next visit', async () => {
    const hook = renderHook(() => useCockpit());
    let ws = FakeWebSocket.instances.at(-1)!;
    act(() => { ws.onopen?.({}); });
    const push = (f: ServerMsg) => act(() => { ws.onmessage?.({ data: JSON.stringify(f) }); });
    push({ t: 'sessions', items: [{ id: U, title: 'u', relative: 'agora', snippet: 's', mtime: 1 }, { id: V, title: 'v', relative: 'agora', snippet: 's', mtime: 1 }] } as ServerMsg);
    act(() => { hook.result.current.setActiveId(U); });
    act(() => { hook.result.current.setActiveId(V); });
    // socket drops and comes back
    vi.useFakeTimers();
    act(() => { ws.readyState = 3; ws.onclose?.({ code: 1006 }); });
    act(() => { vi.advanceTimersByTime(10_000); });
    vi.useRealTimers();
    ws = FakeWebSocket.instances.at(-1)!;
    act(() => { ws.onopen?.({}); });
    ws.sent.length = 0;
    act(() => { hook.result.current.setActiveId(U); });
    const opens = ws.sent.map((d) => JSON.parse(d)).filter((m) => m.t === 'open' && m.sessionId === U);
    expect(opens.length).toBe(1);
  });
});
