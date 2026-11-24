import { describe, it, expect } from 'vitest';
import { isEdgeOpenSwipe, isCloseSwipe } from './swipe';

describe('swipe', () => {
  it('opens only from the left edge, moving right', () => {
    expect(isEdgeOpenSwipe({ x: 6, y: 300 }, { x: 120, y: 310 })).toBe(true);
    expect(isEdgeOpenSwipe({ x: 80, y: 300 }, { x: 200, y: 300 })).toBe(false);
    expect(isEdgeOpenSwipe({ x: 6, y: 300 }, { x: 30, y: 300 })).toBe(false);
  });
  it('rejects diagonal drags', () => {
    expect(isEdgeOpenSwipe({ x: 6, y: 300 }, { x: 100, y: 420 })).toBe(false);
    expect(isCloseSwipe({ x: 250, y: 300 }, { x: 150, y: 420 })).toBe(false);
  });
  it('closes on a left swipe', () => {
    expect(isCloseSwipe({ x: 250, y: 300 }, { x: 150, y: 310 })).toBe(true);
    expect(isCloseSwipe({ x: 150, y: 300 }, { x: 250, y: 300 })).toBe(false);
  });
});
