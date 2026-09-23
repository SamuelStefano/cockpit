// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { shouldShowGhostBanner, useGhostBanner } from './useGhostBanner';

describe('shouldShowGhostBanner', () => {
  // canvas review #593 third pass item 2: the mount decision must NEVER
  // depend on `running` — it isn't even a parameter here, so a turn
  // starting/stopping structurally cannot change whether the fixed-height
  // strip is mounted (and so cannot resize the terminal/pty beneath it).
  it('true for a session with a subtitle, not dismissed', () => {
    expect(shouldShowGhostBanner(true, false, 'fez X e parou')).toBe(true);
  });

  it('false when dismissed', () => {
    expect(shouldShowGhostBanner(true, true, 'fez X e parou')).toBe(false);
  });

  it('false with no subtitle', () => {
    expect(shouldShowGhostBanner(true, false, '')).toBe(false);
  });

  it('false for a non-session (shell) node', () => {
    expect(shouldShowGhostBanner(false, false, 'fez X e parou')).toBe(false);
  });
});

describe('useGhostBanner', () => {
  beforeEach(() => localStorage.clear());

  it('starts not dismissed, and dismiss() persists per session', () => {
    const { result } = renderHook(() => useGhostBanner('sess-1'));
    expect(result.current.dismissed).toBe(false);
    act(() => result.current.dismiss());
    expect(result.current.dismissed).toBe(true);
  });

  it('dismissing one session does not dismiss another', () => {
    const { result: a } = renderHook(() => useGhostBanner('sess-1'));
    const { result: b } = renderHook(() => useGhostBanner('sess-2'));
    act(() => a.current.dismiss());
    expect(a.current.dismissed).toBe(true);
    expect(b.current.dismissed).toBe(false);
  });

  it('survives a remount (persisted, not just component state)', () => {
    const { result, unmount } = renderHook(() => useGhostBanner('sess-1'));
    act(() => result.current.dismiss());
    unmount();
    const { result: reopened } = renderHook(() => useGhostBanner('sess-1'));
    expect(reopened.current.dismissed).toBe(true);
  });
});
