// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCockpit } from './useCockpit';
import { TOKEN_EXPIRED_EVENT } from './lib/auth-events';

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readonly OPEN = 1;
  readyState = 1;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(public url: string) { FakeWebSocket.instances.push(this); }
  send() {}
  close() { this.readyState = 3; }
}

beforeEach(() => { FakeWebSocket.instances = []; vi.stubGlobal('WebSocket', FakeWebSocket); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('relay closes the socket at token expiry (4001)', () => {
  it('asks the auth layer for a fresh token and does not show the login gate', () => {
    const onExpired = vi.fn();
    window.addEventListener(TOKEN_EXPIRED_EVENT, onExpired);
    const hook = renderHook(() => useCockpit());
    const ws = FakeWebSocket.instances.at(-1)!;
    act(() => { ws.onopen?.({}); });
    act(() => { ws.readyState = 3; ws.onclose?.({ code: 4001 }); });
    expect(onExpired).toHaveBeenCalledOnce();
    expect(hook.result.current.authRequired).toBe(false);
    window.removeEventListener(TOKEN_EXPIRED_EVENT, onExpired);
    hook.unmount();
  });
});
