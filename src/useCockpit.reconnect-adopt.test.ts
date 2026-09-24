// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCockpit } from './useCockpit';
import { groupByRecency } from './components/sessions/group-by-recency';
import type { ServerMsg, SessionMeta } from '../shared/protocol';

// Regression guard for PR #588: a session whose first turn is still running is keyed
// `new-…` on the server. A client that did NOT start it (F5, another device, a fresh
// tab) has no local `new-` row, so the uuid row from `sessions` must be ADOPTED under
// the `new-` key — not dropped — or the session vanishes from the sidebar until the
// turn ends. These tests drive the real hook through the exact frame sequence the
// server emits on connect (server/ws/dispatch.ts: `sessions`, then the durable
// snapshot `busy` + `replay`).

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

describe('fresh client adopts a running new- session on reconnect', () => {
  it('bootstrap order (sessions → busy → replay) keeps exactly one row, under the new- key, in the running bucket', () => {
    const { hook, push } = mount();
    push(sessionsFrame(), busyFrame(), replayFrame());
    const ids = hook.result.current.sessions.map((s) => s.id);
    expect(ids).toEqual([NEW_KEY]);
    expect(ids).not.toContain(UUID);
    const [bucket] = groupByRecency(hook.result.current.sessions, { now: NOW, pinned: new Set(), running: hook.result.current.running });
    expect(bucket.items.map((s) => s.id)).toEqual([NEW_KEY]);
    // Adopted row keeps what the server knows about the session.
    expect(hook.result.current.sessions[0].title).toBe('Campaigns analytics');
  });

  it('reversed order (replay before sessions) yields the same single adopted row', () => {
    const { hook, push } = mount();
    push(busyFrame(), replayFrame(), sessionsFrame());
    expect(hook.result.current.sessions.map((s) => s.id)).toEqual([NEW_KEY]);
  });

  it('a later re-list carrying the uuid again does not duplicate the row', () => {
    const { hook, push } = mount();
    push(sessionsFrame(), busyFrame(), replayFrame());
    push(sessionsFrame());
    push(sessionsFrame());
    expect(hook.result.current.sessions.map((s) => s.id)).toEqual([NEW_KEY]);
  });

  it('done migrates the adopted row to the uuid, once', () => {
    const { hook, push } = mount();
    push(sessionsFrame(), busyFrame(), replayFrame());
    push(doneFrame());
    push(sessionsFrame());
    expect(hook.result.current.sessions.map((s) => s.id)).toEqual([UUID]);
    expect(hook.result.current.running.has(NEW_KEY)).toBe(false);
    expect(hook.result.current.running.has(UUID)).toBe(false);
  });
});
