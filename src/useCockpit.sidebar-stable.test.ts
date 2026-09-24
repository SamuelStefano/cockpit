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

const SID = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';

beforeEach(() => { FakeWebSocket.instances = []; vi.stubGlobal('WebSocket', FakeWebSocket); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

// Everything App hands to the sessions sidebar. A streamed delta must not give any
// of them a new identity, or memo(SessionsPanel) re-renders the whole list anyway.
const SIDEBAR = ['sessions', 'archived', 'running', 'stalled', 'updated', 'runStart', 'usage', 'usageModel', 'searchResults', 'marathon', 'funnelBusy',
  'onToggleMarathon', 'onRename', 'onDescribe', 'onClose', 'onDelete', 'onStop', 'onUnhide', 'onSearch', 'onFunnel', 'setActiveId', 'onNew'] as const;

describe('sidebar inputs across a streamed delta', () => {
  it('keep their identity', () => {
    const hook = renderHook(() => useCockpit());
    const ws = FakeWebSocket.instances.at(-1)!;
    const push = (f: ServerMsg) => act(() => { ws.onmessage?.({ data: JSON.stringify(f) }); });
    act(() => { ws.onopen?.({}); });
    push({ t: 'sessions', items: [{ id: SID, title: 't', relative: 'agora', snippet: 's', mtime: 1 }] } as ServerMsg);
    push({ t: 'started', sessionKey: SID, sessionId: SID } as unknown as ServerMsg);
    push({ t: 'delta', sessionKey: SID, text: 'a' });
    const before = hook.result.current as unknown as Record<string, unknown>;
    const snap = Object.fromEntries(SIDEBAR.map((k) => [k, before[k]]));
    push({ t: 'delta', sessionKey: SID, text: 'b' });
    const after = hook.result.current as unknown as Record<string, unknown>;
    const changed = SIDEBAR.filter((k) => snap[k] !== after[k]);
    expect(changed).toEqual([]);
  });
});

describe('SessionsPanel', () => {
  it('is memoized', async () => {
    const { SessionsPanel } = await import('./components/Sessions');
    expect((SessionsPanel as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for('react.memo'));
  });
});
