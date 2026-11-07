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
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; }
}

beforeEach(() => { FakeWebSocket.instances = []; vi.stubGlobal('WebSocket', FakeWebSocket); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('capacity frame', () => {
  it('is null until the server sends one, then follows live and cap', () => {
    const hook = renderHook(() => useCockpit());
    const ws = FakeWebSocket.instances.at(-1)!;
    const push = (f: unknown) => act(() => { ws.onmessage?.({ data: JSON.stringify(f) }); });
    act(() => { ws.onopen?.({}); });
    expect(hook.result.current.capacity).toBeNull();
    push({ t: 'capacity', live: 2, cap: 3, configCap: 12, availMb: 1200 } satisfies ServerMsg);
    expect(hook.result.current.capacity).toEqual({ live: 2, cap: 3, configCap: 12, availMb: 1200 });
    push({ t: 'capacity', live: 3, cap: 3, configCap: 12, availMb: 900 } satisfies ServerMsg);
    expect(hook.result.current.capacity?.live).toBe(3);
  });

  it('keeps the same object when only the megabytes moved', () => {
    const hook = renderHook(() => useCockpit());
    const ws = FakeWebSocket.instances.at(-1)!;
    const push = (f: unknown) => act(() => { ws.onmessage?.({ data: JSON.stringify(f) }); });
    act(() => { ws.onopen?.({}); });
    push({ t: 'capacity', live: 1, cap: 3, configCap: 12, availMb: 1200 });
    const first = hook.result.current.capacity;
    push({ t: 'capacity', live: 1, cap: 3, configCap: 12, availMb: 1250 });
    expect(hook.result.current.capacity).toBe(first);
  });

  it('a frame an older client has never heard of leaves it untouched', () => {
    const hook = renderHook(() => useCockpit());
    const ws = FakeWebSocket.instances.at(-1)!;
    act(() => { ws.onopen?.({}); });
    expect(() => act(() => { ws.onmessage?.({ data: JSON.stringify({ t: 'brand-new-frame', x: 1 }) }); })).not.toThrow();
    expect(hook.result.current.capacity).toBeNull();
  });
});
