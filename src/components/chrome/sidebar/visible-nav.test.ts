import { describe, expect, it } from 'vitest';
import { visibleNav } from './visible-nav';

const items = ['/a', '/b', '/c', '/d', '/e', '/f'].map((to) => ({ to })) as { to: never }[];

describe('visibleNav', () => {
  it('shows only the first routes when collapsed', () => {
    expect(visibleNav(items, false, '/x' as never)).toHaveLength(3);
  });
  it('shows every route when expanded', () => {
    expect(visibleNav(items, true, '/x' as never)).toHaveLength(6);
  });
  it('keeps the active and pending routes visible', () => {
    const out = visibleNav(items, false, '/e/sub' as never, { '/f': 2 } as never);
    expect(out.map((i) => i.to)).toEqual(['/a', '/b', '/c', '/e', '/f']);
  });
  it('does not collapse a list that only hides one route', () => {
    expect(visibleNav(items.slice(0, 4), false, '/x' as never)).toHaveLength(4);
  });
});
