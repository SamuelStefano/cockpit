import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FishingSession } from './fishing-session';
import { BITE_MAX_MS, BITE_DELAY_DIP_MS, PHASE_MS, type FishPhase } from './fishing';

function make(rnd = () => 0) {
  const phases: FishPhase[] = [];
  const bites = vi.fn();
  const caught = vi.fn();
  const s = new FishingSession({ phase: (p) => phases.push(p), bite: bites, caught }, rnd);
  return { s, phases, bites, caught };
}

describe('FishingSession', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000); });
  afterEach(() => vi.useRealTimers());

  it('enters, fishes, then reels, waves, leaves and goes off when the turn ends', () => {
    const { s, phases } = make();
    s.setActive(true);
    vi.advanceTimersByTime(PHASE_MS.enter);
    expect(s.current).toBe('fish');
    s.setActive(false);
    vi.advanceTimersByTime(PHASE_MS.reel + PHASE_MS.wave + PHASE_MS.leave);
    expect(phases).toEqual(['enter', 'fish', 'reel', 'wave', 'leave', 'off']);
  });

  it('bites after the delay and delivers a catch, then keeps fishing', () => {
    const { s, bites, caught } = make(() => 0);
    s.setActive(true);
    vi.advanceTimersByTime(PHASE_MS.enter + 10_000 + BITE_DELAY_DIP_MS);
    expect(bites).toHaveBeenCalledTimes(1);
    expect(caught).toHaveBeenCalledTimes(1);
    expect(caught.mock.calls[0][0].id).toBe('fish');
    vi.advanceTimersByTime(10_000 + BITE_DELAY_DIP_MS);
    expect(caught).toHaveBeenCalledTimes(2);
  });

  it('a click catches right away, then the cooldown blocks the next one', () => {
    const { s, caught } = make();
    s.setActive(true);
    vi.advanceTimersByTime(PHASE_MS.enter + 100);
    expect(s.click()).toBe(true);
    vi.advanceTimersByTime(BITE_DELAY_DIP_MS);
    expect(caught).toHaveBeenCalledTimes(1);
    expect(s.click()).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(s.click()).toBe(true);
  });

  it('ignores clicks outside the fishing phase', () => {
    const { s } = make();
    expect(s.click()).toBe(false);
    s.setActive(true);
    expect(s.click()).toBe(false);
  });

  it('never delivers a catch after the turn ended', () => {
    const { s, caught } = make(() => 0.99);
    s.setActive(true);
    vi.advanceTimersByTime(PHASE_MS.enter + 100);
    s.setActive(false);
    vi.advanceTimersByTime(BITE_MAX_MS * 2);
    expect(caught).not.toHaveBeenCalled();
  });

  it('can start again while leaving, and stop() clears everything', () => {
    const { s, phases } = make();
    s.setActive(true);
    vi.advanceTimersByTime(PHASE_MS.enter);
    s.setActive(false);
    vi.advanceTimersByTime(PHASE_MS.reel);
    s.setActive(true);
    expect(s.current).toBe('enter');
    s.stop();
    expect(s.current).toBe('off');
    vi.advanceTimersByTime(60_000);
    expect(phases[phases.length - 1]).toBe('off');
  });
});
