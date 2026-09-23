import { describe, it, expect } from 'vitest';
import { MAX_K, fitView, toWorld, zoomAt } from './useCanvasViewport';

describe('viewport math', () => {
  it('zoomAt keeps the point under the cursor fixed', () => {
    const v = { x: 10, y: 20, k: 0.5 };
    const before = toWorld(v, 300, 200);
    const after = toWorld(zoomAt(v, 300, 200, 1.7), 300, 200);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('zoom is clamped', () => {
    expect(zoomAt({ x: 0, y: 0, k: 1 }, 0, 0, 100).k).toBe(MAX_K);
  });

  it('fitView centers the bounds and never zooms past 1', () => {
    const v = fitView({ x: 0, y: 0, w: 100, h: 100 }, 1000, 800);
    expect(v.k).toBe(1);
    expect(v.x).toBe(450);
    expect(v.y).toBe(350);
  });
});
