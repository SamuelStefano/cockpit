// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { TermApi } from '../../useCockpit';
import { useCanvasTerms } from './useCanvasTerms';

const term: TermApi = {
  attach: vi.fn(), detach: vi.fn(), input: vi.fn(), resize: vi.fn(), kill: vi.fn(), resume: vi.fn(),
};

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });

describe('useCanvasTerms — resumedLive double-writer guard', () => {
  it('resume() marks the session resumedLive (prompt bar must disable)', () => {
    const { result } = renderHook(() => useCanvasTerms(term, [], vi.fn()));
    expect(result.current.resumedLive.has('sess-1')).toBe(false);
    act(() => result.current.resume('sess-1'));
    expect(result.current.resumedLive.has('sess-1')).toBe(true);
    expect(term.resume).toHaveBeenCalledWith('w-sess1', 'sess-1'); // watchTermId strips dashes
  });

  // canvas review #593 second pass item 6: collapsing the window is the only
  // client-side signal available that the pane "went back" — verify the
  // guard actually clears, and that reopening afterward does NOT resurrect a
  // stale disabled state (the prompt bar must be usable again).
  it('collapsing the window clears resumedLive; reopening later stays clear until resumed again', () => {
    const { result } = renderHook(() => useCanvasTerms(term, [], vi.fn()));
    act(() => result.current.resume('sess-1'));
    expect(result.current.resumedLive.has('sess-1')).toBe(true);

    act(() => result.current.collapse('s:sess-1'));
    expect(result.current.resumedLive.has('sess-1')).toBe(false);

    // Reopen (a fresh window for the same session) — the guard must stay
    // OFF; nothing here should be able to bring it back except another
    // explicit resume() call.
    act(() => result.current.openWindow('s:sess-1'));
    expect(result.current.resumedLive.has('sess-1')).toBe(false);
    expect(result.current.open).toContain('s:sess-1');
  });

  it('collapsing an UNRELATED session does not clear another session\'s guard', () => {
    const { result } = renderHook(() => useCanvasTerms(term, [], vi.fn()));
    act(() => result.current.resume('sess-1'));
    act(() => result.current.collapse('s:sess-2'));
    expect(result.current.resumedLive.has('sess-1')).toBe(true);
  });

  it('collapsing a non-session (shell) window id is a no-op for resumedLive', () => {
    const { result } = renderHook(() => useCanvasTerms(term, [], vi.fn()));
    act(() => result.current.resume('sess-1'));
    act(() => result.current.collapse('t:cv-abc123'));
    expect(result.current.resumedLive.has('sess-1')).toBe(true);
  });
});

describe('useCanvasTerms — never a `w-` follower window for the Orchestrator\'s own session', () => {
  const orchestratorSessionId = 'orch-sid';

  it('openWindow refuses the Orchestrator session node id', () => {
    const { result } = renderHook(() => useCanvasTerms(term, [], vi.fn(), orchestratorSessionId));
    act(() => result.current.openWindow(`s:${orchestratorSessionId}`));
    expect(result.current.open).not.toContain(`s:${orchestratorSessionId}`);
  });

  it('openMany drops it while keeping every other requested id', () => {
    const { result } = renderHook(() => useCanvasTerms(term, [], vi.fn(), orchestratorSessionId));
    act(() => result.current.openMany([`s:${orchestratorSessionId}`, 's:other']));
    expect(result.current.open).toContain('s:other');
    expect(result.current.open).not.toContain(`s:${orchestratorSessionId}`);
  });

  it('autoOpen (running-session auto-open) drops it too', () => {
    const { result } = renderHook(() => useCanvasTerms(term, [], vi.fn(), orchestratorSessionId));
    act(() => result.current.autoOpen([`s:${orchestratorSessionId}`, 's:other']));
    expect(result.current.open).toContain('s:other');
    expect(result.current.open).not.toContain(`s:${orchestratorSessionId}`);
  });

  it('a stale persisted entry (from before this exclusion existed) is filtered out of `open` on mount', () => {
    localStorage.setItem('cockpit:canvas.openTerms', JSON.stringify([`s:${orchestratorSessionId}`, 's:other']));
    const { result } = renderHook(() => useCanvasTerms(term, [], vi.fn(), orchestratorSessionId));
    expect(result.current.open).toContain('s:other');
    expect(result.current.open).not.toContain(`s:${orchestratorSessionId}`);
  });

  it('without an orchestratorSessionId, nothing is excluded (existing behavior unchanged)', () => {
    const { result } = renderHook(() => useCanvasTerms(term, [], vi.fn()));
    act(() => result.current.openWindow(`s:${orchestratorSessionId}`));
    expect(result.current.open).toContain(`s:${orchestratorSessionId}`);
  });
});
