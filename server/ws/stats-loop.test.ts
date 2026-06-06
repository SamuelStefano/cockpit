import { describe, it, expect } from 'vitest';
import { evalSaturation, SAT_PCT, SAT_WINDOW_MS } from './stats-loop';

const cold = { cpuHotSince: 0, memHotSince: 0 };

describe('evalSaturation', () => {
  it('does not saturate while below the threshold', () => {
    const r = evalSaturation(cold, SAT_PCT - 1, SAT_PCT - 1, 1000);
    expect(r.state).toEqual(cold);
    expect(r.saturated).toBeUndefined();
  });

  it('starts the streak but stays calm before the window elapses', () => {
    const r = evalSaturation(cold, SAT_PCT, 0, 1000);
    expect(r.state.cpuHotSince).toBe(1000);
    expect(r.saturated).toBeUndefined();
  });

  it('saturates once the streak crosses the window, with seconds since hot', () => {
    const start = { cpuHotSince: 1000, memHotSince: 0 };
    const now = 1000 + SAT_WINDOW_MS;
    const r = evalSaturation(start, SAT_PCT, 0, now);
    expect(r.saturated).toEqual({ cpu: true, mem: false, seconds: SAT_WINDOW_MS / 1000 });
  });

  it('cooling resets the streak to zero', () => {
    const hot = { cpuHotSince: 1000, memHotSince: 0 };
    const r = evalSaturation(hot, SAT_PCT - 5, 0, 1000 + SAT_WINDOW_MS);
    expect(r.state.cpuHotSince).toBe(0);
    expect(r.saturated).toBeUndefined();
  });

  it('reports the longer-running streak when both are saturated', () => {
    const both = { cpuHotSince: 5000, memHotSince: 1000 };
    const now = 1000 + SAT_WINDOW_MS + 10_000;
    const r = evalSaturation(both, SAT_PCT, SAT_PCT, now);
    expect(r.saturated?.cpu).toBe(true);
    expect(r.saturated?.mem).toBe(true);
    expect(r.saturated?.seconds).toBe(Math.round((now - 1000) / 1000));
  });
});
