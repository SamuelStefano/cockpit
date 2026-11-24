import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MischiefScheduler, type MischiefTiming } from './mischief-scheduler';

const T: MischiefTiming = { idleMs: 45_000, thinkMs: 20_000, cooldownMs: 150_000, quietMs: 4_000 };

function setup() {
  const start = vi.fn();
  const interrupt = vi.fn();
  const s = new MischiefScheduler({ start, interrupt }, T);
  return { s, start, interrupt };
}

describe('MischiefScheduler', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts after the idle window, not before', () => {
    const { s, start } = setup();
    s.setEnabled(true);
    vi.advanceTimersByTime(44_999);
    expect(start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(start).toHaveBeenCalledWith('idle');
  });

  it('any activity restarts the idle window', () => {
    const { s, start } = setup();
    s.setEnabled(true);
    vi.advanceTimersByTime(40_000);
    s.activity();
    vi.advanceTimersByTime(40_000);
    expect(start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('a long-thinking turn starts it sooner, once the user is quiet', () => {
    const { s, start } = setup();
    s.setEnabled(true);
    s.setThinking(true);
    vi.advanceTimersByTime(18_000);
    s.activity();
    vi.advanceTimersByTime(2_000);
    expect(start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(start).toHaveBeenCalledWith('thinking');
  });

  it('a turn that ends early never triggers the thinking skit', () => {
    const { s, start } = setup();
    s.setEnabled(true);
    s.setThinking(true);
    vi.advanceTimersByTime(10_000);
    s.setThinking(false);
    vi.advanceTimersByTime(20_000);
    expect(start).not.toHaveBeenCalled();
  });

  it('input while playing interrupts and starts the cooldown', () => {
    const { s, start, interrupt } = setup();
    s.setEnabled(true);
    vi.advanceTimersByTime(45_000);
    expect(s.isPlaying).toBe(true);
    s.activity();
    expect(interrupt).toHaveBeenCalledTimes(1);
    expect(s.isPlaying).toBe(false);
    vi.advanceTimersByTime(149_000);
    expect(start).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1_000);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('waits the full cooldown after a skit ends on its own', () => {
    const { s, start } = setup();
    s.setEnabled(true);
    vi.advanceTimersByTime(45_000);
    s.ended();
    vi.advanceTimersByTime(149_999);
    expect(start).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('activity outside a skit does not call interrupt', () => {
    const { s, interrupt } = setup();
    s.setEnabled(true);
    s.activity();
    expect(interrupt).not.toHaveBeenCalled();
  });

  it('disabled (reduced motion, pref off, hidden tab) never starts and stops a running skit', () => {
    const { s, start, interrupt } = setup();
    vi.advanceTimersByTime(100_000);
    expect(start).not.toHaveBeenCalled();
    s.setEnabled(true);
    vi.advanceTimersByTime(45_000);
    s.setEnabled(false);
    expect(interrupt).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(500_000);
    expect(start).toHaveBeenCalledTimes(1);
  });
});
