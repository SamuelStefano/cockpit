import { describe, it, expect } from 'vitest';
import { collapsedWindow } from './todo-window';

const plan = (statuses: string[]) => statuses.map((status, i) => ({ content: `t${i}`, status })) as never;

describe('collapsedWindow', () => {
  it('keeps the start when the active item is already inside', () => {
    expect(collapsedWindow(plan(['completed', 'in_progress', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending']), 6)).toEqual({ start: 0, end: 6 });
  });

  it('slides to show the item in progress past the first six', () => {
    const w = collapsedWindow(plan(['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'in_progress', 'pending', 'pending']), 6);
    expect(w).toEqual({ start: 4, end: 10 });
  });

  it('falls back to the first pending item, then to the end', () => {
    expect(collapsedWindow(plan(['completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'completed', 'pending']), 6)).toEqual({ start: 2, end: 8 });
    expect(collapsedWindow(plan(Array(9).fill('completed')), 6)).toEqual({ start: 3, end: 9 });
  });

  it('shows everything when it fits', () => {
    expect(collapsedWindow(plan(['pending', 'pending']), 6)).toEqual({ start: 0, end: 2 });
  });
});
