import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClaudeAuthWatch } from './claude-auth-watch';

describe('claudeAuthWatch', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function setup(initial = false) {
    let ok = initial;
    const emit = vi.fn();
    const w = createClaudeAuthWatch({ ready: () => ok, emit, intervalMs: 5_000 });
    return { w, emit, setReady: (v: boolean) => { ok = v; } };
  }

  it('does not poll when already ready', () => {
    const { w, emit } = setup(true);
    w.ensure();
    vi.advanceTimersByTime(30_000);
    expect(emit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('broadcasts ready once it flips and stops polling', () => {
    const { w, emit, setReady } = setup();
    w.ensure();
    vi.advanceTimersByTime(10_000);
    expect(emit).not.toHaveBeenCalled();
    setReady(true);
    vi.advanceTimersByTime(5_000);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ t: 'claude-auth', ready: true });
    vi.advanceTimersByTime(30_000);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a single timer across repeated ensure calls', () => {
    const { w } = setup();
    w.ensure(); w.ensure(); w.ensure();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('kick re-checks immediately', () => {
    const { w, emit, setReady } = setup();
    w.ensure();
    setReady(true);
    w.kick();
    expect(emit).toHaveBeenCalledWith({ t: 'claude-auth', ready: true });
  });
});
