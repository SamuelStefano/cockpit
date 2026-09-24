// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { clampToRange, nextPlayT, useTimeline } from './useTimeline';

describe('clampToRange', () => {
  it('passes a value already inside the range through', () => {
    expect(clampToRange(50, 0, 100)).toBe(50);
  });
  it('clamps below start and above end', () => {
    expect(clampToRange(-10, 0, 100)).toBe(0);
    expect(clampToRange(200, 0, 100)).toBe(100);
  });
});

describe('nextPlayT', () => {
  it('advances by the step while below the end', () => {
    const r = nextPlayT(0, 1_000_000);
    expect(r.done).toBe(false);
    expect(r.t).toBeGreaterThan(0);
  });
  it('clamps to end and reports done once the step would overshoot it', () => {
    const end = 1000;
    const r = nextPlayT(end - 1, end);
    expect(r).toEqual({ t: end, done: true });
  });
});

describe('useTimeline — range staleness', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(1_000_000); });
  afterEach(() => { vi.useRealTimers(); });

  it('re-captures now the instant a scrub starts FROM live, not the stale mount-time value', () => {
    const { result } = renderHook(() => useTimeline());
    expect(result.current.rangeEnd).toBe(1_000_000);
    vi.setSystemTime(2_000_000); // time passes while still live, no interaction yet
    act(() => result.current.setT(500_000));
    expect(result.current.live).toBe(false);
    expect(result.current.rangeEnd).toBe(2_000_000); // refreshed, not frozen at mount
  });

  it('does not drift the range while already scrubbing mid-drag', () => {
    const { result } = renderHook(() => useTimeline());
    act(() => result.current.setT(500_000));
    const frozenEnd = result.current.rangeEnd;
    vi.setSystemTime(3_000_000);
    act(() => result.current.setT(600_000));
    expect(result.current.rangeEnd).toBe(frozenEnd); // unchanged: no longer live, no refresh
  });

  it('re-captures now on goLive', () => {
    const { result } = renderHook(() => useTimeline());
    act(() => result.current.setT(500_000));
    vi.setSystemTime(4_000_000);
    act(() => result.current.goLive());
    expect(result.current.live).toBe(true);
    expect(result.current.rangeEnd).toBe(4_000_000);
    expect(result.current.t).toBe(4_000_000);
  });
});

describe('useTimeline play from live', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] }); vi.setSystemTime(1_000_000_000); });
  afterEach(() => vi.useRealTimers());

  it('starts a full window back from the REAL now, not the one frozen at mount', () => {
    const { result } = renderHook(() => useTimeline());
    vi.setSystemTime(1_000_000_000 + 3_600_000); // an hour passes while live
    act(() => { result.current.play(); });
    expect(result.current.rangeEnd).toBe(1_000_000_000 + 3_600_000);
    expect(result.current.t).toBe(result.current.rangeStart);
  });
});
