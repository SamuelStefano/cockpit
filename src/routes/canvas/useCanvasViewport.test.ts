// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MAX_K, fitView, toWorld, zoomAt, useCanvasViewport } from './useCanvasViewport';

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

describe('centerOn', () => {
  // A window (TERM_W×TERM_H) needs a higher zoom floor than a node card to
  // read as more than a grey smear — the caller picks (canvas review #620
  // item 3: CanvasSurface passes 1 for a window, the 0.7 default for a node).
  it('floors zoom at the caller-supplied minK, not the old hardcoded 0.7', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.ref.current = document.createElement('div'); });
    act(() => { result.current.centerOn({ x: 0, y: 0 }, 640, 400, 1); });
    expect(result.current.view.k).toBe(1);
  });

  it('still defaults to 0.7 when no minK is passed', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.ref.current = document.createElement('div'); });
    act(() => { result.current.centerOn({ x: 0, y: 0 }); });
    expect(result.current.view.k).toBe(0.7);
  });

  it('never zooms OUT past the current zoom to center — minK only floors up', () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.ref.current = document.createElement('div'); });
    act(() => { result.current.centerOn({ x: 0, y: 0 }, 248, 92, 1); }); // k: 0.5 -> 1
    act(() => { result.current.centerOn({ x: 0, y: 0 }, 640, 400, 0.7); }); // already above 0.7
    expect(result.current.view.k).toBe(1);
  });
});
