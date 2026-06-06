import { describe, it, expect } from 'vitest';
import { selectEvictions } from './evict';

const base = { active: 'x', cap: 3, running: new Set<string>(), inFlight: new Set<string>(), lastActivity: {} as Record<string, number> };

describe('selectEvictions', () => {
  it('returns nothing when at or below the cap', () => {
    expect(selectEvictions(['a', 'b', 'c'], { ...base, cap: 3 })).toEqual([]);
  });

  it('evicts the oldest by activity down to the cap', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const lastActivity = { a: 40, b: 10, c: 30, d: 20 };
    expect(selectEvictions(keys, { ...base, active: 'a', cap: 2, lastActivity })).toEqual(['b', 'd']);
  });

  it('never evicts the active, running, in-flight, or new- threads', () => {
    const keys = ['active', 'run', 'flight', 'new-z', 'old'];
    const opts = {
      ...base,
      active: 'active',
      cap: 1,
      running: new Set(['run']),
      inFlight: new Set(['flight']),
      lastActivity: { old: 1, active: 2, run: 3, flight: 4, 'new-z': 5 },
    };
    expect(selectEvictions(keys, opts)).toEqual(['old']);
  });

  it('treats missing activity as oldest', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const lastActivity = { a: 100, b: 50, c: 80 };
    expect(selectEvictions(keys, { ...base, active: 'a', cap: 2, lastActivity })).toEqual(['d', 'b']);
  });
});
