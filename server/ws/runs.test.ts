import { describe, it, expect } from 'vitest';
import { admitRun } from './runs';

describe('admitRun', () => {
  it('admits while live runs are below the cap', () => {
    expect(admitRun(0, false, 3)).toBe(true);
    expect(admitRun(2, false, 3)).toBe(true);
  });

  it('rejects a brand-new run once the cap is reached', () => {
    expect(admitRun(3, false, 3)).toBe(false);
    expect(admitRun(5, false, 3)).toBe(false);
  });

  it('always admits a run that replaces an existing key, even at the cap', () => {
    expect(admitRun(3, true, 3)).toBe(true);
    expect(admitRun(99, true, 3)).toBe(true);
  });
});
