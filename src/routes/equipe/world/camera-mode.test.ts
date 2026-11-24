import { describe, it, expect } from 'vitest';
import { clampZoom, fitZoom, initialWorldUi, initialZoom, isDemo, parseFocus, parseInitialMode, stepZoom, wheelStep, worldUiReducer } from './camera-mode';

describe('worldUiReducer', () => {
  it('toggles between avatar and god mode', () => {
    const a = initialWorldUi();
    const g = worldUiReducer(a, { t: 'toggle-mode' });
    expect(g.mode).toBe('god');
    expect(worldUiReducer(g, { t: 'toggle-mode' }).mode).toBe('avatar');
  });

  it('keeps the same state object for a no-op set-mode and exit-recording', () => {
    const s = initialWorldUi('god');
    expect(worldUiReducer(s, { t: 'set-mode', mode: 'god' })).toBe(s);
    expect(worldUiReducer(s, { t: 'exit-recording' })).toBe(s);
  });

  it('toggles recording without touching the camera mode', () => {
    const s = worldUiReducer(initialWorldUi('god'), { t: 'toggle-recording' });
    expect(s).toEqual({ mode: 'god', recording: true });
    expect(worldUiReducer(s, { t: 'exit-recording' }).recording).toBe(false);
  });
});

describe('zoom helpers', () => {
  it('only produces whole zoom levels inside the range', () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(99)).toBe(6);
    expect(clampZoom(2.4)).toBe(2);
  });

  it('steps one level per wheel notch or pinch', () => {
    expect(stepZoom(2, 1)).toBe(3);
    expect(stepZoom(2, -1)).toBe(1);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(6, 1)).toBe(6);
    expect(wheelStep(-120)).toBe(1);
    expect(wheelStep(120)).toBe(-1);
    expect(wheelStep(0)).toBe(0);
  });

  it('fits the world at the largest whole zoom', () => {
    expect(fitZoom(1264, 784, 608, 368)).toBe(2);
    expect(fitZoom(1000, 700, 608, 368)).toBe(1);
    expect(fitZoom(0, 800, 608, 368)).toBe(1);
  });

  it('frames the plaza and middle house on a portrait phone', () => {
    expect(initialZoom(390, 844, 608, 368, 256, 368)).toBe(1);
    expect(initialZoom(1264, 784, 608, 368, 256, 368)).toBe(2);
  });
});

describe('url flags', () => {
  it('reads demo and mode from the query string', () => {
    expect(isDemo('?demo=1')).toBe(true);
    expect(isDemo('?demo=0')).toBe(false);
    expect(parseInitialMode('?mode=god')).toBe('god');
    expect(parseInitialMode('')).toBe('avatar');
    expect(parseFocus('?focus=dfl&zoom=3')).toEqual({ house: 'dfl', zoom: 3 });
    expect(parseFocus('?focus=dfl')).toEqual({ house: 'dfl', zoom: 3 });
    expect(parseFocus('')).toBeNull();
  });
});
