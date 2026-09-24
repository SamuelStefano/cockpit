// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCockpit } from './useCockpit';
import { setPref } from './lib/persist';
import { MODEL_KEY } from './lib/account-prefs';
import type { ServerMsg, SessionMeta } from '../shared/protocol';

// A new chat runs as `new-…` until its first `done` carries the real session id;
// the client then migrates every per-session map to that id (migrateKey). These
// drive the real hook through that migration.

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
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

const UUID = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';
const NEW_KEY = 'new-mue7ja1xax2w';
const NOW = 1_790_175_000_000;

const meta = (over: Partial<SessionMeta> = {}): SessionMeta => ({
  id: UUID, title: 'Campaigns analytics', relative: 'agora', snippet: 'first prompt', mtime: NOW, ...over,
} as SessionMeta);

const sessionsFrame = (): ServerMsg => ({ t: 'sessions', items: [meta()] });
const busyFrame = (): ServerMsg => ({ t: 'busy', keys: [NEW_KEY], startedAt: { [NEW_KEY]: NOW - 60_000 } });
const replayFrame = (): ServerMsg => ({ t: 'replay', sessionKey: NEW_KEY, text: 'working…', thinking: '', tools: [], startedAt: NOW - 60_000, sessionId: UUID });
const doneFrame = (): ServerMsg => ({ t: 'done', sessionKey: NEW_KEY, sessionId: UUID });

function mount() {
  const hook = renderHook(() => useCockpit());
  const ws = FakeWebSocket.instances.at(-1)!;
  act(() => { ws.onopen?.({}); });
  const push = (...frames: ServerMsg[]) => {
    act(() => { for (const f of frames) ws.onmessage?.({ data: JSON.stringify(f) }); });
  };
  return { hook, push };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  localStorage.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('new- → session id migration', () => {
  it('keeps the model pinned to the chat, even if the default changed meanwhile', () => {
    const { hook, push } = mount();
    push(sessionsFrame(), busyFrame(), replayFrame());
    act(() => hook.result.current.setActiveId(NEW_KEY));
    act(() => hook.result.current.setModel('opus'));
    act(() => setPref(MODEL_KEY, 'haiku')); // another chat / device changed the default
    push(doneFrame());
    expect(hook.result.current.activeId).toBe(UUID);
    expect(hook.result.current.model).toBe('opus');
  });

  it('a busy snapshot still keyed new- marks the migrated session running, with no ghost key', () => {
    const { hook, push } = mount();
    push(sessionsFrame(), busyFrame(), replayFrame(), doneFrame());
    push({ t: 'busy', keys: [NEW_KEY], startedAt: { [NEW_KEY]: NOW } } as ServerMsg);
    expect(hook.result.current.running.has(UUID)).toBe(true);
    expect(hook.result.current.running.has(NEW_KEY)).toBe(false);
  });
});

describe('socket close', () => {
  it('stops the heartbeat, so a 4401 is not redialed by it later', () => {
    vi.useFakeTimers();
    try {
      mount();
      const ws = FakeWebSocket.instances.at(-1)!;
      const before = FakeWebSocket.instances.length;
      act(() => { ws.onclose?.({ code: 4401 }); });
      act(() => { vi.advanceTimersByTime(5 * 60_000); });
      expect(FakeWebSocket.instances.length).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
