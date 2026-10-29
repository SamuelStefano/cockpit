import { describe, it, expect } from 'vitest';
import { shouldCelebrateCap } from './cap-celebration';

const cap = (state: 'ok' | 'full' | 'over', month = '2026-10') => ({ month, state, capCents: 400_000 });

describe('shouldCelebrateCap', () => {
  it('celebrates a full month once', () => {
    expect(shouldCelebrateCap(cap('full'), '')).toBe(true);
    expect(shouldCelebrateCap(cap('full'), '2026-10')).toBe(false);
    expect(shouldCelebrateCap(cap('full', '2026-11'), '2026-10')).toBe(true);
  });

  it('stays quiet below or over the cap, and without data', () => {
    expect(shouldCelebrateCap(cap('ok'), '')).toBe(false);
    expect(shouldCelebrateCap(cap('over'), '')).toBe(false);
    expect(shouldCelebrateCap(null, '')).toBe(false);
  });
});
