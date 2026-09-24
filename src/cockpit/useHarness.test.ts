import { describe, it, expect } from 'vitest';
import { capHarnessEvents } from './useHarness';

describe('capHarnessEvents', () => {
  it('keeps at most 200 events per task, the most recent ones', () => {
    let m: Record<string, number[]> = {};
    for (let i = 0; i < 250; i++) m = capHarnessEvents(m, 't', i);
    expect(m.t).toHaveLength(200);
    expect(m.t[0]).toBe(50);
    expect(m.t.at(-1)).toBe(249);
  });

  it('keeps event logs only for the 20 most recently active tasks', () => {
    let m: Record<string, number[]> = {};
    for (let i = 0; i < 25; i++) m = capHarnessEvents(m, `t${i}`, i);
    m = capHarnessEvents(m, 't0', 99); // t0 was evicted, comes back as the newest
    expect(Object.keys(m)).toHaveLength(20);
    expect(m.t0).toEqual([99]);
    expect(m.t5).toBeUndefined();
  });
});
