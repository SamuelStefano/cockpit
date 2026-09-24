// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCockpit } from './useCockpit';

class FakeWebSocket {
  static readonly OPEN = 1;
  readonly OPEN = 1;
  readyState = 1;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(public url: string) {}
  send() {}
  close() { this.readyState = 3; }
}

const SID = '6ef8f243-a5aa-4082-bb40-29b66e7fa756';

beforeEach(() => { vi.stubGlobal('WebSocket', FakeWebSocket); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('draft persistence', () => {
  it('writes drafts to localStorage once per pause in typing, and flushes on unmount', () => {
    const hook = renderHook(() => useCockpit());
    act(() => { hook.result.current.setActiveId(SID); });
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const draftWrites = () => setItem.mock.calls.filter(([k]) => String(k).includes('drafts')).length;
    for (const v of ['h', 'he', 'hel', 'hell', 'hello']) act(() => { hook.result.current.setDraft(v); });
    expect(draftWrites()).toBe(0);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(draftWrites()).toBe(1);
    act(() => { hook.result.current.setDraft('hello!'); });
    hook.unmount();
    expect(draftWrites()).toBe(2);
    expect(localStorage.getItem([...Array(localStorage.length).keys()].map((i) => localStorage.key(i)!).find((k) => k.includes('drafts'))!)).toContain('hello!');
  });
});
