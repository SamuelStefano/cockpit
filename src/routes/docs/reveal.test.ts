import { describe, it, expect } from 'vitest';
import { nearestScroll } from './reveal';

describe('nearestScroll', () => {
  it('keeps the position when the item is already in view', () => {
    expect(nearestScroll(100, 400, 200, 30)).toBe(100);
  });
  it('scrolls forward just enough to show an item past the end', () => {
    // item 900..930, view 400 → end + pad (938) at the bottom edge
    expect(nearestScroll(0, 400, 900, 30)).toBe(538);
  });
  it('scrolls back to an item above the view', () => {
    expect(nearestScroll(500, 400, 120, 30)).toBe(112);
  });
  it('never goes below 0', () => {
    expect(nearestScroll(50, 400, 2, 30)).toBe(0);
  });
  it('an item taller than the view aligns its start', () => {
    expect(nearestScroll(0, 100, 300, 500)).toBe(292);
  });
});
