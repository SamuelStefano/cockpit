import { describe, it, expect } from 'vitest';
import { lifeBar } from './life-bar';

describe('lifeBar', () => {
  it('hides when there is no reading', () => {
    expect(lifeBar(null)).toBeNull();
    expect(lifeBar(0)).toBeNull();
  });

  it('turns amber, red and pulses from 85%', () => {
    expect(lifeBar(40)).toMatchObject({ color: 'var(--ok)', pulse: false });
    expect(lifeBar(75)).toMatchObject({ color: 'var(--warn)', pulse: false });
    expect(lifeBar(85)).toMatchObject({ pulse: true });
    expect(lifeBar(95)).toMatchObject({ color: 'var(--err)', pulse: true });
    expect(lifeBar(140)?.pct).toBe(100);
  });
});
