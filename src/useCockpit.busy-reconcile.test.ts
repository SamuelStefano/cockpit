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

beforeEach(() => { FakeWebSocket.instances = []; vi.stubGlobal('WebSocket', FakeWebSocket); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

function mount() {
  const hook = renderHook(() => useCockpit());
  const ws = FakeWebSocket.instances.at(-1)!;
  act(() => { ws.onopen?.({}); });
  const push = (f: ServerMsg) => act(() => { ws.onmessage?.({ data: JSON.stringify(f) }); });
  const opens = () => ws.sent.map((d) => JSON.parse(d)).filter((m) => m.t === 'open' && m.sessionId === U).length;
  return { hook, push, opens };
}

describe('busy snapshot after frames were lost with the socket', () => {
  it("a first turn whose done was lost migrates to its session id and re-fetches", () => {
    const { hook, push, opens } = mount();
    act(() => { hook.result.current.onNew(); });
    const key = hook.result.current.activeId;
    act(() => { hook.result.current.onSend('oi'); });
    push({ t: 'started', sessionKey: key } as ServerMsg);
    push({ t: 'system', sessionKey: key, sessionId: U });
    push({ t: 'delta', sessionKey: key, text: 'meia resp' });
    push({ t: 'busy', keys: [], startedAt: {} });
    expect(hook.result.current.activeId).toBe(U);
    expect(opens()).toBeGreaterThan(0);
  });

  it('a stop whose done was lost does not hide the next run of the session', () => {
    const { hook, push } = mount();
    push({ t: 'sessions', items: [{ id: U, title: 't', relative: 'agora', snippet: 's', mtime: 1 }] } as ServerMsg);
    act(() => { hook.result.current.setActiveId(U); });
    act(() => { hook.result.current.onSend('vai'); });
    push({ t: 'started', sessionKey: U } as ServerMsg);
    act(() => { hook.result.current.onStop(U); });
    push({ t: 'busy', keys: [], startedAt: {} });
    push({ t: 'busy', keys: [U], startedAt: { [U]: 1 } });
    push({ t: 'replay', sessionKey: U, text: 'x', thinking: '', tools: [], startedAt: 1, sessionId: U } as ServerMsg);
    push({ t: 'delta', sessionKey: U, text: 'y' });
    expect(hook.result.current.phase).not.toBe('idle');
  });
});
