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
const T0 = 1_790_175_000_000;

beforeEach(() => { FakeWebSocket.instances = []; vi.stubGlobal('WebSocket', FakeWebSocket); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

const text = (m: unknown) => JSON.stringify(m);

describe('history arriving while a turn streams', () => {
  it('reconnect mid-run: the reply keeps growing after the history snapshot', () => {
    const hook = renderHook(() => useCockpit());
    const ws = FakeWebSocket.instances.at(-1)!;
    const push = (f: ServerMsg) => act(() => { ws.onmessage?.({ data: JSON.stringify(f) }); });
    act(() => { ws.onopen?.({}); });
    push({ t: 'sessions', items: [{ id: U, title: 't', relative: 'agora', snippet: 's', mtime: T0 }] } as ServerMsg);
    act(() => { hook.result.current.setActiveId(U); });
    push({ t: 'busy', keys: [U], startedAt: { [U]: T0 } });
    push({ t: 'replay', sessionKey: U, text: 'part one ', thinking: '', tools: [], startedAt: T0, sessionId: U } as ServerMsg);
    push({ t: 'history', sessionId: U, messages: [
      { id: 'u1', role: 'user', text: 'do it', ts: T0 + 2000 },
      { id: 'a1', role: 'assistant', blocks: [{ type: 'text', md: 'part one' }], ts: T0 + 5000 },
    ] } as unknown as ServerMsg);
    push({ t: 'delta', sessionKey: U, text: 'LATER-DELTA' });
    const all = text(hook.result.current.messages);
    expect(all).toContain('LATER-DELTA');
    expect(all).toContain('do it');
    expect(all.split('part one').length - 1).toBe(1); // the snapshot's copy of the live text is left to the bubble
  });
});
